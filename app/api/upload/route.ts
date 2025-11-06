import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongo-client"
import { logUploadError, formatErrorForUser, extractErrorDetails } from "@/lib/error-logger"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  console.log(`[v0] [${requestId}] Upload metadata request received`)

  try {
    const body = await request.json()
    const {
      editorId,
      caption,
      mediaType,
      fileName,
      mediaUrl,
      mediaPath,
      thumbnailUrl,
      thumbnailPath,
      fileSize,
    }: {
      editorId?: string
      caption?: string
      mediaType?: "video" | "image"
      fileName?: string
      mediaUrl?: string
      mediaPath?: string
      thumbnailUrl?: string | null
      thumbnailPath?: string | null
      fileSize?: number
    } = body

    console.log(`[v0] [${requestId}] Metadata payload:`, {
      editorId,
      captionLength: caption?.length,
      mediaType,
      fileName,
      hasThumbnail: Boolean(thumbnailUrl),
      mediaUrl,
      mediaPath,
      fileSize,
    })

    if (!editorId) {
      throw new Error("Editor ID is required")
    }

    if (!caption || !caption.trim()) {
      throw new Error("Description is required")
    }

    if (!mediaType || !["video", "image"].includes(mediaType)) {
      throw new Error("Invalid media type")
    }

    if (!mediaUrl) {
      throw new Error("Missing media URL from blob upload")
    }

    if (!fileName) {
      throw new Error("Missing original file name")
    }

    const db = await getDb()

    const insertPayload = {
      editor_id: editorId,
      file_name: fileName,
      caption: caption.trim(),
      media_url: mediaUrl,
      ...(mediaPath ? { media_path: mediaPath } : {}),
      media_type: mediaType,
      ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}),
      ...(thumbnailPath ? { thumbnail_path: thumbnailPath } : {}),
      created_at: new Date(),
    }

    try {
      const result = await db.collection("uploads").insertOne(insertPayload)
  const inserted = await db.collection("uploads").findOne({ _id: result.insertedId })

  console.log(`[v0] [${requestId}] Upload metadata stored successfully for editor ${editorId}`)

  return NextResponse.json({ ...inserted, id: String(inserted?._id) }, { status: 201 })
    } catch (err) {
      console.error(`[v0] [${requestId}] Failed to insert upload metadata:`, err)
      await logUploadError({
        error_type: "DATABASE_INSERT_FAILED",
        error_message: `Failed to save upload metadata: ${err instanceof Error ? err.message : String(err)}`,
        editor_id: editorId,
        file_name: fileName,
        file_size: fileSize,
        details: { dbError: err, requestId },
      })
      throw new Error(`Failed to save upload metadata: ${err instanceof Error ? err.message : String(err)}`)
    }
  } catch (error) {
    console.error(`[v0] [${requestId}] Upload metadata error:`, error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const userMessage = formatErrorForUser(error)

    await logUploadError({
      error_type: "UPLOAD_METADATA_FAILED",
      error_message: errorMessage,
      details: { error: extractErrorDetails(error), requestId },
    })

    return NextResponse.json(
      {
        error: userMessage,
        details: errorMessage,
        requestId,
      },
      { status: 400 },
    )
  }
}
