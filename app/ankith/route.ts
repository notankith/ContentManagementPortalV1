import { NextResponse } from "next/server"

export async function GET() {
  // Internal redirect route to preserve a "redirected link" to ankith.studio
  return NextResponse.redirect("https://ankith.studio/", 307)
}
