import { NextResponse } from "next/server"
import { getDb } from "@/lib/mongo-client"

export async function GET() {
  try {
    const db = await getDb()

  const uploads = await db.collection("uploads").find({}).toArray()

  // Read persisted daily stats (includes archived items) and use these as the authoritative
  // historical counts. We'll also count any active uploads from `uploads` that have not yet
  // been archived and add them to the per-day totals so the graph is current.
  const persisted = await db.collection('daily_stats').find({}).toArray()

  // Count by editor type when available for active uploads (video vs graphic). Fall back to media_type column if editor type missing.
  const activeReels = (Array.isArray(uploads) ? uploads.filter((u: any) => (u.editors && u.editors.type === "video") || u.media_type === "video").length : 0) || 0
  const activeImages = (Array.isArray(uploads) ? uploads.filter((u: any) => (u.editors && u.editors.type === "graphic") || u.media_type === "image").length : 0) || 0

  // Build a Monday -> Sunday view for the current week (7 days). Start with persisted daily_stats data.
  const dailyStats: { [key: string]: { videos: number; images: number; dayName: string } } = {}
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    // Determine the Monday of the current week (treat week as Monday..Sunday)
    const dayIndex = now.getDay() // 0 = Sunday, 1 = Monday ...
    const daysSinceMonday = (dayIndex + 6) % 7
    const monday = new Date(now)
    monday.setDate(monday.getDate() - daysSinceMonday)

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    const toLocalDateKey = (d: Date) => {
      // normalize to local YYYY-MM-DD to avoid timezone shifts
      const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      return t.toISOString().split("T")[0]
    }

    for (let i = 0; i < 7; i++) {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
      const dateStr = toLocalDateKey(date)
      const dayName = dayNames[date.getDay()]
      // Start with persisted counts if present
      const persistedEntry = persisted.find((p: any) => p.date === dateStr)
      dailyStats[dateStr] = {
        videos: persistedEntry ? (persistedEntry.reels || 0) : 0,
        images: persistedEntry ? (persistedEntry.posts || 0) : 0,
        dayName,
      }
    }

    // Add active uploads that haven't been archived yet to the day's totals (avoid double-counting persisted data)
    (uploads || []).forEach((item: any) => {
      try {
        const dateStr = new Date(item.created_at).toISOString().split('T')[0]
        if (dateStr in dailyStats) {
          const isVideo = (item.editors && item.editors.type === 'video') || item.media_type === 'video'
          const isImage = (item.editors && item.editors.type === 'graphic') || item.media_type === 'image'
          if (isVideo) dailyStats[dateStr].videos++
          else if (isImage) dailyStats[dateStr].images++
        }
      } catch (e) {
        // ignore malformed dates
      }
    })

    const dailyStatsArray = Object.entries(dailyStats).map(([date, counts]: any) => ({
      date,
      dayName: counts.dayName,
      reels: counts.videos,
      posts: counts.images,
      total: counts.videos + counts.images,
    }))

    // Compute weekly totals (reels/posts)
    const weeklyTotals = dailyStatsArray.reduce(
      (acc: { reels: number; posts: number }, cur: any) => {
        acc.reels += cur.reels
        acc.posts += cur.posts
        return acc
      },
      { reels: 0, posts: 0 }
    )

    return NextResponse.json({ weeklyTotals, weeklyStats: dailyStatsArray })
  } catch (error) {
    console.error("[v0] Stats error:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
