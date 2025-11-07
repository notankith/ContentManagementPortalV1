import { NextResponse } from "next/server"
import { getDb } from "@/lib/mongo-client"
import cloudinaryStorage from "@/lib/cloudinary-storage"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    if (!body?.confirm) {
      return NextResponse.json({ error: "Confirmation required" }, { status: 400 })
    }

    const db = await getDb()

    const uploads = await db.collection('uploads').find({}).project({ media_path: 1, thumbnail_path: 1, media_url: 1, thumbnail_url: 1 }).toArray()
    const logs = await db.collection('logs').find({}).project({ media_path: 1, thumbnail_path: 1, media_url: 1, thumbnail_url: 1 }).toArray()

    const extractPublicId = (obj: any): string | null => {
      if (!obj) return null
      if (obj.media_path) return obj.media_path
      if (obj.thumbnail_path) return obj.thumbnail_path
      const url = obj.media_url || obj.thumbnail_url
      if (!url) return null
      try {
        const u = new URL(url)
        // Look for '/upload/' segment used by Cloudinary URLs
        const parts = u.pathname.split('/').filter(Boolean)
        const uploadIndex = parts.findIndex(p => p === 'upload')
        if (uploadIndex >= 0) {
          // public_id is everything after upload/(optional transformations)/(optional version)/
          let publicParts = parts.slice(uploadIndex + 1)
          // remove version component like 'v123456789' if present
          if (publicParts.length > 0 && /^v\d+$/.test(publicParts[0])) publicParts = publicParts.slice(1)
          // join and remove file extension
          const last = publicParts.join('/')
          return last.replace(/\.[^/.]+$/, '')
        }
      } catch (e) {
        // ignore
      }
      return null
    }

    const publicIds = new Set<string>()
    for (const u of uploads) {
      const p = extractPublicId(u)
      if (p) publicIds.add(p)
    }
    for (const l of logs) {
      const p = extractPublicId(l)
      if (p) publicIds.add(p)
    }

    const results: any[] = []
    let totalUploadsDeleted = 0
    let totalLogsUpdated = 0
    const succeededIds: string[] = []
    const failedIds: string[] = []

    for (const id of Array.from(publicIds)) {
      // attempt to delete as image first, if that fails try as video
      try {
        const cloudResp = await cloudinaryStorage.deleteVideo(id, `Delete by admin delete-cloudinary-files at ${new Date().toISOString()}`, "image")
        const uploadsDeleted = await db.collection('uploads').deleteMany({ $or: [{ media_path: id }, { thumbnail_path: id }] })
        const logsUpdated = await db.collection('logs').updateMany({ $or: [{ media_path: id }, { thumbnail_path: id }, { media_url: { $regex: id } }, { thumbnail_url: { $regex: id } }] }, { $unset: { media_path: "", thumbnail_path: "", media_url: "", thumbnail_url: "" } })

        totalUploadsDeleted += uploadsDeleted.deletedCount
        totalLogsUpdated += logsUpdated.modifiedCount
        succeededIds.push(id)

        results.push({ id, ok: true, attempted: "image", cloudinary: cloudResp, uploadsDeleted: uploadsDeleted.deletedCount, logsUpdated: logsUpdated.modifiedCount })
        continue
      } catch (errImage: any) {
        // try video delete as fallback
        try {
          const cloudResp = await cloudinaryStorage.deleteVideo(id, `Delete by admin delete-cloudinary-files at ${new Date().toISOString()}`, "video")
          const uploadsDeleted = await db.collection('uploads').deleteMany({ $or: [{ media_path: id }, { thumbnail_path: id }] })
          const logsUpdated = await db.collection('logs').updateMany({ $or: [{ media_path: id }, { thumbnail_path: id }, { media_url: { $regex: id } }, { thumbnail_url: { $regex: id } }] }, { $unset: { media_path: "", thumbnail_path: "", media_url: "", thumbnail_url: "" } })

          totalUploadsDeleted += uploadsDeleted.deletedCount
          totalLogsUpdated += logsUpdated.modifiedCount
          succeededIds.push(id)

          results.push({ id, ok: true, attempted: "video", cloudinary: cloudResp, uploadsDeleted: uploadsDeleted.deletedCount, logsUpdated: logsUpdated.modifiedCount })
          continue
        } catch (errVideo: any) {
          failedIds.push(id)
          // include any available body/status info for diagnostics
          const imageErr = { message: errImage?.message || String(errImage), body: errImage?.body ?? null, status: errImage?.status ?? null }
          const videoErr = { message: errVideo?.message || String(errVideo), body: errVideo?.body ?? null, status: errVideo?.status ?? null }

          results.push({ id, ok: false, error: { image: imageErr, video: videoErr } })
        }
      }
    }

    const summary = {
      processed: results.length,
      succeeded: succeededIds.length,
      failed: failedIds.length,
      uploadsDeletedTotal: totalUploadsDeleted,
      logsUpdatedTotal: totalLogsUpdated,
      succeededIds,
      failedIds,
      details: results,
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error('delete-cloudinary-files error:', error)
    return NextResponse.json({ error: 'Failed to delete Cloudinary files' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
