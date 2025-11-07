import { NextResponse } from "next/server"
import cloudinaryStorage from "@/lib/cloudinary-storage"

export async function GET() {
  try {
  const result = await cloudinaryStorage.checkRepoAccess()
  return NextResponse.json({ ok: true, result })
  } catch (err) {
    console.error("[cloudinary-debug] Error:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

export const runtime = "nodejs"
