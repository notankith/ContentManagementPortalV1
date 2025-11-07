/**
 * Cloudinary-backed storage helper.
 *
 * Exports the same function names as the previous GitHub helper so callers don't
 * need to change imports. Internally this uses Cloudinary's upload API.
 *
 * Required env vars:
 * - CLOUDINARY_CLOUD_NAME
 * - CLOUDINARY_API_KEY
 * - CLOUDINARY_API_SECRET
 * Optional:
 * - CLOUDINARY_UPLOAD_PRESET (if you prefer unsigned uploads)
 */

import crypto from "crypto"

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
const API_KEY = process.env.CLOUDINARY_API_KEY
const API_SECRET = process.env.CLOUDINARY_API_SECRET
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET

function ensureConfigured() {
  if (!CLOUD_NAME) throw new Error("CLOUDINARY_CLOUD_NAME not set")
  if (!API_KEY || !API_SECRET) {
    if (!UPLOAD_PRESET) {
      throw new Error("Cloudinary not configured. Set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET, or CLOUDINARY_UPLOAD_PRESET for unsigned uploads.")
    }
  }
}

async function postForm(url: string, form: FormData) {
  const res = await fetch(url, { method: "POST", body: form })
  const text = await res.text()
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text), text }
  } catch (e) {
    return { ok: res.ok, status: res.status, json: null, text }
  }
}

export async function uploadVideo(path: string, buffer: Buffer, message?: string, filename?: string) {
  ensureConfigured()

  // Decide whether this is an image or a video based on filename or path extension.
  // Many callers pass a filename; otherwise fall back to path. If no extension
  // is available default to video (legacy behavior).
  const candidate = (filename || path || "").toString()
  const extMatch = candidate.match(/\.([^.\\/]+)$/)
  const ext = extMatch ? String(extMatch[1]).toLowerCase() : null
  const imageExts = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff", "heic", "heif", "avif"]
  const isImage = ext ? imageExts.includes(ext) : false

  const endpoint = isImage ? "image" : "video"
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${endpoint}/upload`

  // Cloudinary accepts data URIs as the 'file' field. Use a matching MIME
  // type for images to avoid 'Unsupported file type' errors (e.g. 'image/png').
  const mimeType = isImage && ext ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : 'application/octet-stream'
  const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`

  const form = new FormData()
  form.append("file", dataUri)

  // Use the provided path as the public_id (keeps folder-like structure).
  // Some Cloudinary accounts reject values that contain certain characters in the
  // display name. To avoid errors like `Display name cannot contain slashes`,
  // replace raw forward slashes in the incoming path with underscores while
  // still keeping the rest of the string intact.
  let publicIdToUse: string | undefined = undefined
  if (path) {
    publicIdToUse = String(path).replace(/^\/+/, "").replace(/[\/\\]/g, "_")
     .replace(/^\/+/, "")
    .replace(/[\/\\]/g, "_")
    .replace(/[^\w.-]/g, "_") // remove any illegal characters
    form.append("public_id", publicIdToUse)
  } else {
  // fallback to something safe and flat
  publicIdToUse = "upload_" + Date.now()
  form.append("public_id", publicIdToUse)
}

  // Provide an explicit filename/original_filename so Cloudinary won't derive
  // a display name that might contain invalid characters like slashes.
  if (filename) {
    const safeFilename = String(filename).replace(/\//g, "_")
    .replace(/^.*[\\/]/, "")   // strips any path-like prefix
    .replace(/[^\w.-]/g, "_")  // replaces any weird symbols
    form.append("filename", safeFilename)
    form.append("original_filename", safeFilename)
  }  else {
  // fallback name if missing
  form.append("filename", "upload_" + Date.now())
  form.append("original_filename", "upload_" + Date.now())
}

  // If an upload preset is provided, use unsigned upload (no signature needed)
  if (UPLOAD_PRESET) {
    form.append("upload_preset", UPLOAD_PRESET)
  } else {
    // Signed upload: include api_key, timestamp and signature
    const timestamp = Math.floor(Date.now() / 1000)
    form.append("api_key", API_KEY as string)
    form.append("timestamp", String(timestamp))

    // Build string to sign (public_id and timestamp). Cloudinary requires parameters to be
  const paramsToSign: Array<[string, string]> = []
  if (publicIdToUse) paramsToSign.push(["public_id", publicIdToUse])
    paramsToSign.push(["timestamp", String(timestamp)])

    const toSign = paramsToSign
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${v}`)
      .join("&")

    const signature = crypto.createHash("sha1").update(toSign + API_SECRET).digest("hex")
    form.append("signature", signature)
  }

  const result = await postForm(url, form)

  if (!result.ok) {
    // Log the attempted identifiers for debugging (avoid logging secrets)
    console.error("[cloudinary] upload failed", {
      status: result.status,
      public_id: publicIdToUse,
      filename: filename,
      body: result.text?.slice ? result.text.slice(0, 2000) : String(result.text),
    })
    const errText = result.text || JSON.stringify(result.json)
    const err = new Error(`Cloudinary upload failed: ${result.status} ${errText}`)
    ;(err as any).status = result.status
    ;(err as any).body = result.text
    throw err
  }

  const resp = result.json
  // Return a stable secure URL and the public_id so callers can store it as media_path.
  // Note: Cloudinary will return the final public_id it stored (which will match
  // `publicIdToUse` when a path was provided).
  return { apiResponse: resp, rawUrl: resp.secure_url, public_id: resp.public_id }
}

export async function deleteVideo(publicId: string, message?: string, resourceType: "image" | "video" = "image") {
  ensureConfigured()

  if (!publicId) {
    throw new Error("deleteVideo requires a publicId (media_path stored from upload)")
  }

  // Choose endpoint by resource type
  const endpointType = resourceType === "video" ? "video" : "image"
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${endpointType}/destroy`

  // Sanitize the incoming publicId to avoid issues if callers pass slashes
  const safePublicId = String(publicId).replace(/^\/+/, "").replace(/[\/\\]/g, "_").replace(/[^\w.-]/g, "_")

  const timestamp = Math.floor(Date.now() / 1000)
  const paramsToSign = `public_id=${safePublicId}&timestamp=${timestamp}`
  const signature = crypto.createHash("sha1").update(paramsToSign + API_SECRET).digest("hex")

  const form = new FormData()
  form.append("public_id", safePublicId)
  form.append("api_key", API_KEY as string)
  form.append("timestamp", String(timestamp))
  form.append("signature", signature)
  // Ask Cloudinary to invalidate CDN cached versions so deleted resources stop serving
  form.append("invalidate", "true")

  const result = await postForm(url, form)

  if (!result.ok) {
    const errText = result.text || JSON.stringify(result.json)
    const err = new Error(`Cloudinary delete failed (${endpointType}): ${result.status} ${errText}`)
    ;(err as any).status = result.status
    ;(err as any).body = result.text
    throw err
  }

  return result.json
}

export default { uploadVideo, deleteVideo, checkRepoAccess }

export async function checkRepoAccess() {
  // Return some basic diagnostic information about Cloudinary configuration and connectivity
  try {
    ensureConfigured()
  } catch (err) {
    return { ok: false, error: String(err) }
  }

  // Try a light-weight list call for images (max_results=1)
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image/list?max_results=1`
  const auth = Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64")

  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } })
  const text = await res.text().catch(() => "<no body>")
  if (!res.ok) {
    return { ok: false, status: res.status, body: text }
  }

  try {
    const json = JSON.parse(text)
    return { ok: true, status: res.status, info: { count: json.total_count ?? json.resources?.length ?? 0 } }
  } catch (e) {
    return { ok: true, status: res.status, body: text }
  }
}

// Explicit named exports for compatibility with static import analysis
// Note: functions `uploadVideo` and `deleteVideo` are exported by name above and
// included in the default export below for compatibility.
