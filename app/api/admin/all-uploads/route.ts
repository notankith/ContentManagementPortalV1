import { NextResponse } from "next/server"
import { getDb } from "@/lib/mongo-client"

export async function GET() {
  try {
    const db = await getDb()

    const uploads = await db.collection("uploads").find({}).sort({ created_at: -1 }).toArray()

    const editorIds = Array.from(new Set(uploads.map((u: any) => u.editor_id).filter(Boolean)))
    const editors = await db.collection("editors").find({ id: { $in: editorIds } }).toArray()
    const editorMap: Record<string, any> = {}
    editors.forEach((e: any) => {
      editorMap[e.id] = e
    })

    const mapped = uploads.map((u: any) => ({
      id: String(u._id),
      file_name: u.file_name,
      caption: u.caption,
      media_url: u.media_url,
      created_at: u.created_at,
      editor_id: u.editor_id,
      editors: editorMap[u.editor_id]
        ? { id: editorMap[u.editor_id].id, name: editorMap[u.editor_id].name, type: editorMap[u.editor_id].type }
        : null,
    }))

    return NextResponse.json(mapped || [])
  } catch (error) {
    console.error("Error fetching all uploads:", error)
    return NextResponse.json({ error: "Failed to fetch uploads" }, { status: 500 })
  }
}
