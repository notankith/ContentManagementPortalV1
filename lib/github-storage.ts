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
// Deprecated shim: re-export Cloudinary storage functions from the new module name.
// This file remains for backward compatibility while imports are updated across
// the codebase. New code should import from `@/lib/cloudinary-storage`.

export { uploadVideo, deleteVideo, checkRepoAccess } from "./cloudinary-storage"

export default { uploadVideo: (async () => {}), deleteVideo: (async () => {}) }
