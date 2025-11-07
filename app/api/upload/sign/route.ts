import { NextResponse } from "next/server"
import crypto from "crypto"

export const runtime = "nodejs"

/**
 * Returns a Cloudinary signature and timestamp for direct browser uploads.
 * Request body (JSON): { public_id?: string }
 * Response: { signature, timestamp, api_key }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    let publicId = body?.public_id || body?.publicId || ""
    // Sanitize incoming publicId: remove or replace slashes to avoid Cloudinary
    // display name errors. Mirror the sanitization used by uploads.
    if (publicId) {
      publicId = String(publicId).replace(/^\/+/, "").replace(/[\/\\]/g, "_")
    }

    const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
    const API_KEY = process.env.CLOUDINARY_API_KEY
    const API_SECRET = process.env.CLOUDINARY_API_SECRET

    if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
      return NextResponse.json({ error: "Cloudinary not configured on server" }, { status: 500 })
    }

    const timestamp = Math.floor(Date.now() / 1000)

  const paramsToSign: Array<[string, string]> = []
  if (publicId) paramsToSign.push(["public_id", publicId])
    paramsToSign.push(["timestamp", String(timestamp)])

    const toSign = paramsToSign
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${v}`)
      .join("&")

    const signature = crypto.createHash("sha1").update(toSign + API_SECRET).digest("hex")

    return NextResponse.json({ signature, timestamp, api_key: API_KEY })
  } catch (err) {
    console.error("/api/upload/sign error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET() {
  // simple health/check endpoint for Cloudinary config
  const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
  const API_KEY = process.env.CLOUDINARY_API_KEY
  const API_SECRET = process.env.CLOUDINARY_API_SECRET
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return NextResponse.json({ ok: false, configured: false })
  }
  return NextResponse.json({ ok: true, configured: true })
}
