import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongo-client"

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Fetching all editors")
    const db = await getDb()
    const docs = await db.collection("editors").find({}).sort({ created_at: -1 }).toArray()

    console.log("[v0] Successfully fetched editors:", docs?.length || 0)
    return NextResponse.json(docs.map((d: any) => ({ ...d, id: String(d._id) })))
  } catch (error) {
    console.error("[v0] Error fetching editors:", error)
    return NextResponse.json({ error: "Failed to fetch editors" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
  console.log("[v0] Creating new editor")
  const { name, type, description } = await request.json()

    if (!name || !name.trim()) {
      console.warn("[v0] Editor name is required")
      return NextResponse.json({ error: "Editor name is required" }, { status: 400 })
    }

    if (!type || !["video", "graphic"].includes(type)) {
      console.warn("[v0] Invalid editor type:", type)
      return NextResponse.json({ error: "Invalid editor type. Must be 'video' or 'graphic'" }, { status: 400 })
    }

    if (!description || description.trim().length === 0) {
      console.warn("[v0] Editor description is required")
      return NextResponse.json({ error: "Description is required and cannot be empty" }, { status: 400 })
    }

    const secretLink = `${type}-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`
    console.log("[v0] Generated secret link:", secretLink)

    const db = await getDb()
    const now = new Date()
    const insert = {
      name: name.trim(),
      type,
      description: description.trim(),
      secret_link: secretLink,
      created_at: now,
    }

    const result = await db.collection("editors").insertOne(insert)
    const created = await db.collection("editors").findOne({ _id: result.insertedId })

    console.log("[v0] Editor created successfully:", created?._id)
    return NextResponse.json({ ...created, id: String(created?._id) }, { status: 201 })
  } catch (error) {
    console.error("[v0] Error creating editor:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        error: "Failed to create editor",
        details: errorMessage,
        message: "Please check your input and try again",
      },
      { status: 500 },
    )
  }
}
