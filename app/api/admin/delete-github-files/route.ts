import { NextResponse } from "next/server"

// Deprecated route: this endpoint previously deleted files from the GitHub-backed
// storage. The project migrated to Cloudinary — use `/api/admin/delete-cloudinary-files`
// instead. Return 410 Gone to indicate the route is retired.
export async function POST() {
  return NextResponse.json(
    { error: "delete-github-files is deprecated. Use /api/admin/delete-cloudinary-files instead." },
    { status: 410 },
  )
}

export const runtime = 'nodejs'
