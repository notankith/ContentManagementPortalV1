import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongo-client"

export async function POST(request: NextRequest) {
  try {
    const db = await getDb()

    // Get today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Fetch today's uploads
    const todayUploads = await db
      .collection("uploads")
      .find({ created_at: { $gte: today, $lt: tomorrow } })
      .toArray()

    if (todayUploads && todayUploads.length > 0) {
      const logsData = todayUploads.map((upload) => ({
        editor_id: upload.editor_id,
        file_name: upload.file_name,
        caption: upload.caption,
        media_url: upload.media_url,
        created_at: upload.created_at,
        archive_reason: "daily_reset",
      }))

      await db.collection("logs").insertMany(logsData)
    }

    // Delete records from database
    const r = await db
      .collection("uploads")
      .deleteMany({ created_at: { $gte: today, $lt: tomorrow } })

    return NextResponse.json({
      success: true,
      archivedCount: r.deletedCount || 0,
    })
  } catch (error) {
    console.error("Reset daily error:", error)
    return NextResponse.json({ error: "Failed to reset daily uploads" }, { status: 500 })
  }
}
