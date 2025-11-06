import { NextResponse } from "next/server"
import { getDb } from "@/lib/mongo-client"
import { deleteVideo } from "@/lib/github-storage"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    if (!body?.confirm) {
      return NextResponse.json({ error: "Confirmation required" }, { status: 400 })
    }

    const db = await getDb()

    // Collect paths from uploads and logs
    const uploads = await db.collection('uploads').find({}).project({ media_path: 1, thumbnail_path: 1, media_url: 1, thumbnail_url: 1 }).toArray()
    const logs = await db.collection('logs').find({}).project({ media_url: 1, media_path: 1, thumbnail_path: 1, thumbnail_url: 1 }).toArray()

    // Helper to extract repo path from raw.githubusercontent URL or use media_path directly
    const extractPath = (obj: any): string | null => {
      if (!obj) return null
      if (obj.media_path) return obj.media_path
      if (obj.thumbnail_path) return obj.thumbnail_path
      const url = obj.media_url || obj.thumbnail_url
      if (!url) return null
      try {
        const u = new URL(url)
        // raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}
        if (u.hostname === 'raw.githubusercontent.com') {
          const parts = u.pathname.split('/').filter(Boolean)
          // path components after owner/repo/branch
          if (parts.length >= 4) {
            return parts.slice(3).join('/')
          }
        }
      } catch (e) {
        // ignore
      }
      return null
    }

    const paths = new Set<string>()
    for (const u of uploads) {
      const p = extractPath(u)
      if (p) paths.add(p)
    }
    for (const l of logs) {
      const p = extractPath(l)
      if (p) paths.add(p)
    }

    const results: any[] = []
    for (const p of Array.from(paths)) {
      try {
        await deleteVideo(p, `Delete by admin delete-github-files at ${new Date().toISOString()}`)
        results.push({ path: p, ok: true })
      } catch (err: any) {
        results.push({ path: p, ok: false, error: err?.message || String(err) })
      }
    }

    return NextResponse.json({ message: `Processed ${results.length} paths`, results })
  } catch (error) {
    console.error('delete-github-files error:', error)
    return NextResponse.json({ error: 'Failed to delete files' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
