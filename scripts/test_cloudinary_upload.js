// Quick test script to POST a public image URL to Cloudinary using signed params
// and sanitized public_id/filename. Run with CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY,
// CLOUDINARY_API_SECRET in env.

const crypto = require('crypto')

async function run() {
  const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
  const API_KEY = process.env.CLOUDINARY_API_KEY
  const API_SECRET = process.env.CLOUDINARY_API_SECRET
  const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || null

  if (!CLOUD_NAME) {
    console.error('CLOUD_NAME not set')
    process.exit(2)
  }
  if (!API_KEY || !API_SECRET) {
    console.error('API_KEY or API_SECRET not set')
    process.exit(2)
  }

  // Sample public image to upload
  const imageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/640px-PNG_transparency_demonstration_1.png'

  // Build sanitized public_id and filename similar to app logic
  const rawPublicId = `uploads/test/2025-11-07/my/test/image.png` // contains slashes intentionally
  const publicId = String(rawPublicId).replace(/^\/+/, '').replace(/[\\/]/g, '_').replace(/[^\w.-]/g, '_')
  const rawFilename = 'my/test/image.png'
  const filename = String(rawFilename).replace(/[\\/]/g, '_').replace(/^.*[\\/]/, '').replace(/[^\w.-]/g, '_')

  console.log('Attempting upload with:')
  console.log(' publicId:', publicId)
  console.log(' filename:', filename)

  const form = new FormData()
  // Cloudinary accepts remote URL in `file` field
  form.append('file', imageUrl)
  form.append('public_id', publicId)
  form.append('filename', filename)
  form.append('original_filename', filename)

  if (UPLOAD_PRESET) {
    form.append('upload_preset', UPLOAD_PRESET)
  } else {
    const timestamp = Math.floor(Date.now() / 1000)
    form.append('api_key', API_KEY)
    form.append('timestamp', String(timestamp))

    // Signature: params sorted by key, only include public_id and timestamp when signing
    const toSign = `public_id=${publicId}&timestamp=${timestamp}`
    const signature = crypto.createHash('sha1').update(toSign + API_SECRET).digest('hex')
    form.append('signature', signature)
  }

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`

  try {
    const res = await fetch(url, { method: 'POST', body: form })
    const text = await res.text()
    console.log('Status:', res.status)
    try {
      console.log('Body:', JSON.parse(text))
    } catch (e) {
      console.log('Body (raw):', text)
    }
  } catch (err) {
    console.error('Network/Fetch error:', err)
  }
}

run()
