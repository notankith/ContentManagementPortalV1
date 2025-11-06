import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongo-client"
import { ObjectId } from "mongodb"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const editorId = searchParams.get("editorId")

    const db = await getDb()

    const q: any = {}
    if (editorId) q.editor_id = editorId

    const docs = await db
      .collection("uploads")
      .find(q)
      .sort({ created_at: -1 })
      .toArray()

    const mapped = docs.map((d: any) => ({ ...d, id: String(d._id) }))
    return NextResponse.json(mapped)
  } catch (error) {
    console.error("Error fetching uploads:", error)
    return NextResponse.json({ error: "Failed to fetch uploads" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const uploadId = searchParams.get("uploadId")

    if (!uploadId) return NextResponse.json({ error: "Missing uploadId" }, { status: 400 })

    const db = await getDb()
    try {
      const _id = new ObjectId(uploadId)
      await db.collection("uploads").deleteOne({ _id })
      return NextResponse.json({ success: true })
    } catch (err) {
      // try fallback: delete by string id field
      await db.collection("uploads").deleteOne({ id: uploadId })
      return NextResponse.json({ success: true })
    }
  } catch (error) {
    console.error("Error deleting upload:", error)
    return NextResponse.json({ error: "Failed to delete upload" }, { status: 500 })
  }
}
