import { NextResponse } from "next/server"

// Read Page credentials from environment variables for safety.
// Ensure you set PAGE_ID and PAGE_TOKEN in your environment or .env file (do NOT commit secrets).
const PAGE_ID = process.env.PAGE_ID ?? ""
const PAGE_TOKEN = process.env.PAGE_TOKEN ?? ""

if (!PAGE_ID || !PAGE_TOKEN) {
  // Log a clear error during server start so maintainers notice missing env vars.
  console.error("Missing PAGE_ID or PAGE_TOKEN environment variables. Please set PAGE_ID and PAGE_TOKEN.")
}

// Fixed schedule times for tomorrow (same as schedule.py)
const REEL_TIMES = ["00:00", "02:00", "04:00", "06:00"]
const POST_TIMES = ["00:30","01:00","01:30","02:30","03:00","03:30","04:30","05:00","05:30","06:30"]

async function schedulePost(item: any, scheduledTime: Date) {
  const timestamp = Math.floor(scheduledTime.getTime() / 1000)

  if ((item.media_type || "").toLowerCase() === "video") {
    const url = `https://graph.facebook.com/v17.0/${PAGE_ID}/videos`
    const payload: any = new URLSearchParams()
    payload.append("description", item.description || "")
    payload.append("file_url", item.media_url || "")
    payload.append("published", "false")
    payload.append("scheduled_publish_time", String(timestamp))
    payload.append("access_token", PAGE_TOKEN)

    const res = await fetch(url, { method: "POST", body: payload })
    return res.json()
  } else {
    // For images, use a two-step approach:
    // 1) Create an unpublished photo on the Page via /{page-id}/photos with published=false
    //    to get a media_fbid.
    // 2) Create a feed post via /{page-id}/feed with attached_media referencing the
    //    media_fbid and set published=false + scheduled_publish_time. This reliably
    //    creates a scheduled photo post (appears in the Page schedule/Creator Studio).

    try {
      if (!item.media_url) {
        // fallback: create a text post scheduled on the feed
        const feedUrl = `https://graph.facebook.com/v17.0/${PAGE_ID}/feed`
        const feedPayload = new URLSearchParams()
        feedPayload.append("message", item.description || "")
        feedPayload.append("published", "false")
        feedPayload.append("scheduled_publish_time", String(timestamp))
        feedPayload.append("access_token", PAGE_TOKEN)

        const feedRes = await fetch(feedUrl, { method: "POST", body: feedPayload })
        const feedJson = await feedRes.json()
        console.log("Scheduled text-only feed response:", feedJson)
        return { feed: feedJson }
      }

      // Step 1: Create unpublished photo
      const photoCreateUrl = `https://graph.facebook.com/v17.0/${PAGE_ID}/photos`
      const photoPayload = new URLSearchParams()
      photoPayload.append("url", item.media_url)
      // do not set caption here; use feed message as the post message
      photoPayload.append("published", "false")
      photoPayload.append("access_token", PAGE_TOKEN)

      const photoRes = await fetch(photoCreateUrl, { method: "POST", body: photoPayload })
      const photoJson = await photoRes.json()
      console.log("Unpublished photo create response:", photoJson)

      const photoId = photoJson && (photoJson.id || photoJson.post_id)
      if (!photoId) {
        // return the photo creation response so caller can inspect error
        return { photo: photoJson }
      }

      // Step 2: Create scheduled feed post that attaches the unpublished photo
      const feedUrl = `https://graph.facebook.com/v17.0/${PAGE_ID}/feed`
      const feedPayload = new URLSearchParams()
      feedPayload.append("message", item.description || "")
      // attached_media needs to be provided as attached_media[0]=JSON
      feedPayload.append("attached_media[0]", JSON.stringify({ media_fbid: String(photoId) }))
      feedPayload.append("published", "false")
      feedPayload.append("scheduled_publish_time", String(timestamp))
      feedPayload.append("access_token", PAGE_TOKEN)

      const feedRes = await fetch(feedUrl, { method: "POST", body: feedPayload })
      const feedJson = await feedRes.json()
      console.log("Scheduled feed create response:", feedJson)

      return { photo: photoJson, post: feedJson }
    } catch (err) {
      console.error("Error scheduling image post:", err)
      return { error: String(err) }
    }
  }
}

export async function POST(request: Request) {
  try {
    // use hard-coded PAGE_TOKEN as provided above

    const body = await request.json()
    const items: any[] = Array.isArray(body.items) ? body.items : []

    if (!items.length) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 })
    }

    // schedule date = tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0,0,0,0)

    const scheduledResults: any[] = []

    const reels = items.filter(i => (i.media_type || "").toLowerCase() === "video")
    const posts = items.filter(i => (i.media_type || "").toLowerCase() === "image")

    // schedule reels (use per-item scheduled_time if provided, otherwise default slots)
    for (let i = 0; i < reels.length; i++) {
      const item = reels[i]
      let scheduled: Date
      if (item.scheduled_time) {
        scheduled = new Date(item.scheduled_time)
      } else if (i < REEL_TIMES.length) {
        const [hourStr, minuteStr] = REEL_TIMES[i].split(":")
        scheduled = new Date(tomorrow)
        scheduled.setHours(parseInt(hourStr, 10), parseInt(minuteStr, 10), 0, 0)
      } else {
        // fallback: next available hour
        scheduled = new Date(tomorrow)
        scheduled.setHours(12 + i, 0, 0, 0)
      }

      const res = await schedulePost(item, scheduled)
      scheduledResults.push({ item, scheduled_time: scheduled.toISOString(), response: res })
    }

    // schedule posts (use per-item scheduled_time if provided, otherwise default slots)
    for (let i = 0; i < posts.length; i++) {
      const item = posts[i]
      let scheduled: Date
      if (item.scheduled_time) {
        scheduled = new Date(item.scheduled_time)
      } else if (i < POST_TIMES.length) {
        const [hourStr, minuteStr] = POST_TIMES[i].split(":")
        scheduled = new Date(tomorrow)
        scheduled.setHours(parseInt(hourStr, 10), parseInt(minuteStr, 10), 0, 0)
      } else {
        scheduled = new Date(tomorrow)
        scheduled.setHours(18 + i, 0, 0, 0)
      }

      const res = await schedulePost(item, scheduled)
      scheduledResults.push({ item, scheduled_time: scheduled.toISOString(), response: res })
    }

    return NextResponse.json({ success: true, scheduled: scheduledResults })
  } catch (error) {
    console.error("Schedule API error:", error)
    return NextResponse.json({ error: "Scheduling failed" }, { status: 500 })
  }
}

export const runtime = "nodejs"
