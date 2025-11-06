import { logUploadError, extractErrorDetails } from "@/lib/error-logger"
import { uploadVideo } from "@/lib/github-storage"
import {
  detectNetworkQuality,
  calculateEstimatedUploadTime,
  formatNetworkDiagnostics,
  type UploadMetrics,
} from "@/lib/network-diagnostics"

// GitHub Contents API isn't suitable for very large files. We set a safe limit.
const SAFE_UPLOAD_LIMIT = 100 * 1024 * 1024 // 100MB

interface UploadProgress {
  loaded: number
  total: number
  percentage: number
  speed?: number // bytes per second
  timeRemaining?: number // seconds
}

/**
 * Upload large files with comprehensive error handling and network diagnostics
 */
export async function uploadLargeFile(
  file: File,
  path: string,
  editorId?: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<string> {
  const uploadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const networkDiagnostics = detectNetworkQuality()
  const estimatedTime = calculateEstimatedUploadTime(file.size, networkDiagnostics)

  console.log(`[v0] [${uploadId}] Starting upload for file: ${file.name}`)
  console.log(`[v0] [${uploadId}] File size: ${(file.size / 1024 / 1024).toFixed(2)}MB`)
  console.log(`[v0] [${uploadId}] Network: ${formatNetworkDiagnostics(networkDiagnostics)}`)
  console.log(`[v0] [${uploadId}] Estimated upload time: ${estimatedTime}s`)

  const metrics: UploadMetrics = {
    startTime: Date.now(),
    lastChunkTime: Date.now(),
    bytesUploaded: 0,
    totalBytes: file.size,
    chunkCount: 0,
    failedChunks: 0,
    retryCount: 0,
    networkInterruptions: 0,
  }

  // For files under 50MB, use direct upload
  if (file.size > SAFE_UPLOAD_LIMIT) {
    throw new Error(`File exceeds safe GitHub upload limit of ${Math.round(SAFE_UPLOAD_LIMIT / 1024 / 1024)}MB. Use an object store or other solution.`)
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const { rawUrl } = await uploadVideo(path, buffer, `Upload ${path}`)

    onProgress?.({
      loaded: file.size,
      total: file.size,
      percentage: 100,
      speed: file.size / ((Date.now() - metrics.startTime) / 1000),
    })

    console.log(`[v0] [${uploadId}] Direct upload (GitHub) successful: ${rawUrl}`)
    return rawUrl
  } catch (error) {
    const errorDetails = extractErrorDetails(error)
    console.error(`[v0] [${uploadId}] Chunked upload failed:`, errorDetails)

    await logUploadError({
      error_type: "CHUNKED_UPLOAD_FAILED",
      error_message: error instanceof Error ? error.message : "Unknown error during chunked upload",
      error_stack: error instanceof Error ? error.stack : undefined,
      file_name: file.name,
      file_size: file.size,
      editor_id: editorId,
      details: {
        ...errorDetails,
        networkDiagnostics,
        metrics,
      },
    })

    throw new Error(
      `Failed to upload large file: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
    )
  }
}

/**
 * Upload with automatic retry and exponential backoff
 */
export async function uploadFileWithRetry(
  file: File,
  path: string,
  editorId?: string,
  maxRetries = 3,
  onProgress?: (progress: UploadProgress) => void,
): Promise<string> {
  let lastError: Error | null = null
  const uploadSessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  console.log(`[v0] [${uploadSessionId}] Starting upload session for: ${file.name}`)

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[v0] [${uploadSessionId}] Upload attempt ${attempt}/${maxRetries}`)
      const url = await uploadLargeFile(file, path, editorId, onProgress)
      console.log(`[v0] [${uploadSessionId}] Upload succeeded on attempt ${attempt}`)
      return url
    } catch (error) {
      lastError = error as Error
      const errorDetails = extractErrorDetails(error)
      console.error(`[v0] [${uploadSessionId}] Upload attempt ${attempt} failed:`, errorDetails)

      if (attempt < maxRetries) {
        // Exponential backoff: 2s, 4s, 8s
        const delayMs = Math.pow(2, attempt) * 1000
        console.log(`[v0] [${uploadSessionId}] Retrying in ${delayMs}ms...`)

        await logUploadError({
          error_type: "UPLOAD_RETRY",
          error_message: `Attempt ${attempt} failed, retrying in ${delayMs}ms`,
          file_name: file.name,
          file_size: file.size,
          editor_id: editorId,
          details: {
            attempt,
            maxRetries,
            delayMs,
            error: errorDetails,
          },
        })

        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  console.error(`[v0] [${uploadSessionId}] Upload failed after ${maxRetries} attempts`)

  await logUploadError({
    error_type: "UPLOAD_FAILED_ALL_RETRIES",
    error_message: `Upload failed after ${maxRetries} attempts: ${lastError?.message || "Unknown error"}`,
    error_stack: lastError?.stack,
    file_name: file.name,
    file_size: file.size,
    editor_id: editorId,
    details: {
      maxRetries,
      finalError: extractErrorDetails(lastError),
    },
  })

  throw lastError || new Error("Failed to upload file after multiple attempts")
}
