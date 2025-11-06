import { NextResponse } from "next/server"
import { logUploadError } from "@/lib/error-logger"
import { uploadVideo } from "@/lib/github-storage"

const MAX_VIDEO_SIZE = 500 * 1024 * 1024 // 500MB (safe limit for GitHub contents API usage)
const MAX_IMAGE_SIZE = 100 * 1024 * 1024 // 100MB

const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska"]
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "_")
}

export const runtime = "nodejs"

export async function POST(request: Request) {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

  try {
    // Expect multipart/form-data with 'file' and 'clientPayload'
    const form = await request.formData()
    const file = form.get("file") as File | null
    const clientPayloadRaw = form.get("clientPayload")?.toString() || "{}"

    let payload: any = {}
    try {
      payload = JSON.parse(clientPayloadRaw)
    } catch (e) {
      throw new Error("Invalid upload metadata payload")
    }

    const editorId = payload?.editorId
    const mediaType = payload?.mediaType ?? "image"
    const isThumbnail = payload?.isThumbnail ?? false
    const fileName = payload?.fileName || (file ? (file as any).name : undefined)
    const fileType = payload?.fileType || (file ? (file as any).type : undefined)
    const fileSize = payload?.fileSize ?? (file ? (file as any).size : 0)

    if (!editorId) throw new Error("Editor ID is required")
    if (!file || !(file instanceof File)) throw new Error("File is required")
    if (!fileName) throw new Error("File name is required")
    if (!fileType) throw new Error("File type is required")

    const allowedTypes = isThumbnail ? IMAGE_TYPES : mediaType === "video" ? VIDEO_TYPES : IMAGE_TYPES
    if (!allowedTypes.includes(fileType)) throw new Error(`Unsupported file type: ${fileType}`)

    const maxSize = isThumbnail ? MAX_IMAGE_SIZE : mediaType === "video" ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
    if ((fileSize as number) > maxSize) throw new Error(`File exceeds maximum size of ${Math.round(maxSize / 1024 / 1024)}MB`)

    const timestamp = Date.now()
    const safeName = sanitizeFileName(fileName)
    const directory = isThumbnail ? "thumbnails" : "uploads"
    const path = `${directory}/${editorId}/${timestamp}-${safeName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { apiResponse, rawUrl } = await uploadVideo(path, buffer, `Upload ${path}`)

    return NextResponse.json({ url: rawUrl, path }, { status: 200 })
  } catch (error) {
    console.error(`[v0] [${requestId}] handleUpload error:`, error)
    const message = error instanceof Error ? error.message : "Unknown error"

    await logUploadError({
      error_type: "UPLOAD_HANDLE_FAILED",
      error_message: message,
      details: { requestId },
    })

    return NextResponse.json({ error: message, requestId }, { status: 400 })
  }
}
