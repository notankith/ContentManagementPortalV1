import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongo-client"
import { ObjectId } from "mongodb"

export async function POST(request: NextRequest) {
  try {
    const db = await getDb()

    // Allow optional body { uploadIds: string[] } to archive only specific uploads.
    const body = await request.json().catch(() => ({}))
    const uploadIds: string[] | undefined = Array.isArray(body?.uploadIds) ? body.uploadIds : undefined

    let filter: any = {}
    if (uploadIds && uploadIds.length > 0) {
      // Convert string ids to ObjectId when possible
      const objectIds = uploadIds.map((id) => {
        try {
          return new ObjectId(id)
        } catch (e) {
          return id
        }
      })
      filter = { $or: [{ _id: { $in: objectIds } }, { id: { $in: uploadIds } }] }
    }

    const uploads = await db.collection("uploads").find(filter).toArray()
    const count = uploads.length

    if (count > 0) {
      const logsData = uploads.map((upload) => ({
        editor_id: upload.editor_id,
        file_name: upload.file_name,
        caption: upload.caption,
        media_url: upload.media_url,
        created_at: upload.created_at,
        archive_reason: "manual",
      }))

      await db.collection("logs").insertMany(logsData)

      // Update daily_stats so archived uploads are persisted in daily counts even after deletion
      // Group uploads by local date (YYYY-MM-DD) and increment reels/posts accordingly
      const countsByDate: Record<string, { reels: number; posts: number }> = {}
      for (const upload of uploads) {
        try {
          const created = upload.created_at ? new Date(upload.created_at) : new Date()
          // normalize to YYYY-MM-DD local
          const t = new Date(created.getTime() - created.getTimezoneOffset() * 60000)
          const dateKey = t.toISOString().split('T')[0]
          const isVideo = (upload.editors && upload.editors.type === 'video') || upload.media_type === 'video'
          if (!countsByDate[dateKey]) countsByDate[dateKey] = { reels: 0, posts: 0 }
          if (isVideo) countsByDate[dateKey].reels++
          else countsByDate[dateKey].posts++
        } catch (e) {
          // ignore malformed dates
        }
      }

      const bulkOps: any[] = []
      for (const [date, counts] of Object.entries(countsByDate)) {
        bulkOps.push({
          updateOne: {
            filter: { date },
            update: { $inc: { reels: counts.reels, posts: counts.posts } , $setOnInsert: { dayName: date } },
            upsert: true,
          },
        })
      }

      if (bulkOps.length > 0) {
        await db.collection('daily_stats').bulkWrite(bulkOps)
      }
    }

    // Delete archived uploads (either filtered or all)
    if (uploadIds && uploadIds.length > 0) {
      await db.collection("uploads").deleteMany(filter)
    } else {
      await db.collection("uploads").deleteMany({})
    }

    return NextResponse.json({ success: true, archivedCount: count })
  } catch (error) {
    console.error("Archive uploads error:", error)
    return NextResponse.json({ error: "Failed to archive uploads" }, { status: 500 })
  }
}

export const runtime = "nodejs"
