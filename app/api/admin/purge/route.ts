import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongo-client"

export async function POST(request: NextRequest) {
  try {
    const db = await getDb()

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Fetch uploads older than 7 days
    const oldUploads = await db.collection("uploads").find({ created_at: { $lt: sevenDaysAgo } }).toArray()

    if (oldUploads && oldUploads.length > 0) {
      const logsData = oldUploads.map((upload) => ({
        editor_id: upload.editor_id,
        file_name: upload.file_name,
        caption: upload.caption,
        media_url: upload.media_url,
        created_at: upload.created_at,
        archive_reason: "purge_old",
      }))

      await db.collection("logs").insertMany(logsData)
    }

    // Delete records from database
    const r = await db.collection("uploads").deleteMany({ created_at: { $lt: sevenDaysAgo } })

    return NextResponse.json({
      success: true,
      archivedCount: r.deletedCount || 0,
    })
  } catch (error) {
    console.error("Purge error:", error)
    return NextResponse.json({ error: "Failed to purge uploads" }, { status: 500 })
  }
}
