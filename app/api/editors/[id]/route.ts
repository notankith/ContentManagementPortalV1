import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongo-client"
import { deleteVideo } from "@/lib/github-storage"
import { ObjectId } from "mongodb"

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
  // Try to determine editor id from route params first, then fall back to
  // query string (e.g. /api/editors?id=...), then finally attempt to read
  // the request body. This helps callers that mistakenly send the id in the
  // wrong place and prevents opaque "id required" errors.
  // Note: in some Next.js setups `params` can be a Promise and must be awaited.
  const resolvedParams: any = await params
  let id: string | undefined = resolvedParams?.id
  console.log("[v0] Incoming delete request URL:", request.nextUrl?.href ?? request.url)
  console.log("[v0] Starting editor deletion for ID (from params):", id)

    if (!id) {
      // Try query string fallback
      try {
        const qsId = request.nextUrl?.searchParams.get("id")
        if (qsId) {
          id = qsId
          console.log("[v0] Found editor id in query string:", id)
        }
      } catch (e) {
        // ignore
      }
    }

    if (!id) {
      // Try body fallback (not typical for DELETE but some clients send JSON)
      try {
        // request.json() may throw if there's no body or invalid JSON
        const body = await request.json().catch(() => null)
        if (body && typeof body === "object" && (body as any).id) {
          id = String((body as any).id)
          console.log("[v0] Found editor id in request body:", id)
        }
      } catch (e) {
        // ignore parsing errors
      }
    }

    if (!id) {
      console.warn("[v0] No editor id provided in params, query string, or body. Request URL:", request.nextUrl?.href ?? request.url)
      return NextResponse.json({ error: "Editor id is required", requestedUrl: request.nextUrl?.href ?? request.url }, { status: 400 })
    }

    const db = await getDb()

    // Fetch uploads for this editor; use media_path/thumbnail_path for deletion when available
    const uploads = await db
      .collection("uploads")
      .find({ editor_id: id })
      .project({ media_url: 1, thumbnail_url: 1, media_path: 1, thumbnail_path: 1 })
      .toArray()

    if (uploads && uploads.length > 0) {
      console.log(`[v0] Deleting ${uploads.length} media files for editor ${id}`)

      for (const upload of uploads) {
        try {
          if (upload.media_path) {
            await deleteVideo(upload.media_path)
            console.log("[v0] Deleted media file (path):", upload.media_path)
          } else if (upload.media_url) {
            // best-effort: attempt to derive path from raw.githubusercontent URL
            const match = typeof upload.media_url === "string" && upload.media_url.match(/https:\/\/raw\.githubusercontent\.com\/.+?\/.+?\/(.+)$/)
            if (match && match[1]) {
              await deleteVideo(decodeURIComponent(match[1]))
              console.log("[v0] Deleted media file (derived path):", match[1])
            }
          }

          if (upload.thumbnail_path) {
            await deleteVideo(upload.thumbnail_path)
            console.log("[v0] Deleted thumbnail file (path):", upload.thumbnail_path)
          } else if (upload.thumbnail_url) {
            const match = typeof upload.thumbnail_url === "string" && upload.thumbnail_url.match(/https:\/\/raw\.githubusercontent\.com\/.+?\/.+?\/(.+)$/)
            if (match && match[1]) {
              await deleteVideo(decodeURIComponent(match[1]))
              console.log("[v0] Deleted thumbnail file (derived path):", match[1])
            }
          }
        } catch (err) {
          console.warn("[v0] Warning: Could not delete file from GitHub, continuing with DB cleanup:", err)
        }
      }
    }

    console.log("[v0] Deleting uploads from database for editor:", id)
    await db.collection("uploads").deleteMany({ editor_id: id })

    console.log("[v0] Deleting logs from database for editor:", id)
    await db.collection("logs").deleteMany({ editor_id: id })

    console.log("[v0] Deleting editor profile for id:", id)
    await db.collection("editors").deleteOne({ _id: new ObjectId(id) }).catch(async () => {
      // fallback: delete by id string field
      await db.collection("editors").deleteOne({ id })
    })

    console.log("[v0] Editor deletion completed successfully")
    return NextResponse.json({
      success: true,
      message: "Editor and all related data deleted successfully",
    })
  } catch (error) {
    console.error("[v0] Delete editor error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
    return NextResponse.json(
      {
        error: "Failed to delete editor",
        details: errorMessage,
        message: "Please try again or contact support if the problem persists",
      },
      { status: 500 },
    )
  }
}
