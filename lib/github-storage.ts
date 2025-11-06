/**
 * Small GitHub-backed storage helper for server-side usage.
 *
 * Notes / caveats:
 * - This uses the GitHub Contents API to create and delete files in a repo.
 * - GitHub has file size limits for the Contents API; large videos should use Git LFS
 *   or a proper blob storage solution. Use this for small test videos or short-term storage.
 * - Required env vars: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO. Optional: GITHUB_BRANCH (default: main)
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_OWNER = process.env.GITHUB_OWNER
const GITHUB_REPO = process.env.GITHUB_REPO
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main"

if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
  // Defer throwing so server start doesn't always fail in environments where not used,
  // but callers should check and surface the error.
}

async function githubApi(path: string, init: RequestInit, options?: { debug?: boolean }) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    ...(init.headers as Record<string, string> || {}),
  }

  const debug = options?.debug || process.env.GITHUB_DEBUG === "true"

  if (debug) {
    // Log URL and method (never log token)
    console.log(`[github-debug] ${init.method ?? "GET"} ${url}`)
    if (init.body) {
      try {
        const bodyPreview = typeof init.body === "string" ? init.body.slice(0, 200) : "<binary or stream>"
        console.log(`[github-debug] request body (truncated): ${bodyPreview}`)
      } catch (e) {
        console.log("[github-debug] request body: <unable to stringify>")
      }
    }
  }

  const res = await fetch(url, { ...init, headers })

  if (debug) {
    const respText = await res.clone().text().catch(() => "<non-text response>")
    console.log(`[github-debug] response status: ${res.status} ${res.statusText}`)
    console.log(`[github-debug] response body (truncated 1k): ${respText.slice(0, 1024)}`)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "<no body>")
    const err = new Error(`GitHub API error: ${res.status} ${res.statusText}: ${text}`)
    ;(err as any).status = res.status
    ;(err as any).body = text
    throw err
  }
  return res.json()
}

export async function uploadVideo(path: string, buffer: Buffer, message?: string) {
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    throw new Error("GitHub storage not configured. Set GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO.")
  }

  const content = buffer.toString("base64")
  const body = {
    message: message || `Add video ${path}`,
    content,
    branch: GITHUB_BRANCH,
  }

  const res = await githubApi(`/contents/${encodeURIComponent(path)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  }, { debug: true })

  // Return a stable raw URL to the file on the default branch
  const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${path}`
  return { apiResponse: res, rawUrl }
}

export async function deleteVideo(path: string, message?: string) {
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    throw new Error("GitHub storage not configured. Set GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO.")
  }

  // Need the file sha to delete
  const fileInfo = await githubApi(`/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, {
    method: "GET",
  }, { debug: true })

  const sha = fileInfo.sha
  if (!sha) throw new Error("Unable to determine file SHA for deletion")

  const body = {
    message: message || `Delete video ${path}`,
    sha,
    branch: GITHUB_BRANCH,
  }

  const res = await githubApi(`/contents/${encodeURIComponent(path)}`, {
    method: "DELETE",
    body: JSON.stringify(body),
  }, { debug: true })

  return res
}

export default { uploadVideo, deleteVideo }

export async function checkRepoAccess() {
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    throw new Error("GitHub storage not configured. Set GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO.")
  }

  const result: any = {}

  // Repo
  try {
    const repo = await githubApi("", { method: "GET" }, { debug: true })
    result.repo = { ok: true, status: 200, name: repo.full_name }
  } catch (err: any) {
    result.repo = { ok: false, status: err?.status || 0, body: err?.body || String(err) }
  }

  // Branch
  try {
    const branch = await githubApi(`/branches/${encodeURIComponent(GITHUB_BRANCH)}`, { method: "GET" }, { debug: true })
    result.branch = { ok: true, status: 200, name: branch.name }
  } catch (err: any) {
    result.branch = { ok: false, status: err?.status || 0, body: err?.body || String(err) }
  }

  // Root contents
  try {
    const contents = await githubApi(`/contents`, { method: "GET" }, { debug: true })
    result.contents = { ok: true, status: 200, length: Array.isArray(contents) ? contents.length : 0 }
  } catch (err: any) {
    result.contents = { ok: false, status: err?.status || 0, body: err?.body || String(err) }
  }

  return result
}
