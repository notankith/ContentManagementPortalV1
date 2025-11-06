"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Trash2, RotateCcw } from "lucide-react"
import { useEffect } from "react"

export function ArchiveManagement() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handlePurgeOldUploads = async () => {
    // Deprecated: replaced by 'Archive uploads' which archives ALL uploads.
    // Keep this function for backward compatibility but notify user to use the new button.
    alert("This action is deprecated. Use the 'Archive uploads' button to archive all uploads.")
  }

  const handleResetDaily = async () => {
    // Deprecated: replaced by 'Archive uploads' which archives ALL uploads.
    alert("This action is deprecated. Use the 'Archive uploads' button to archive all uploads.")
  }

  // New: Archive all uploads (move everything from uploads to logs)
  const handleArchiveAllUploads = async () => {
    if (!confirm("Archive ALL uploads? This will move everything from Uploads into the archive (logs).")) return
    try {
      setIsLoading(true)
      setError(null)
      setSuccess(null)

      const response = await fetch("/api/admin/archive-uploads", { method: "POST" })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Failed to archive uploads")

      setSuccess(`Successfully archived ${data.archivedCount} upload(s) to logs`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive uploads")
    } finally {
      setIsLoading(false)
    }
  }

  // New: Delete all archives (remove everything from logs)
  const handleDeleteAllArchives = async () => {
    if (!confirm("Delete ALL archives? This will permanently remove all archived log entries.")) return
    try {
      setIsLoading(true)
      setError(null)
      setSuccess(null)

      // fetch all logs to get IDs
      const logsRes = await fetch("/api/admin/logs")
      if (!logsRes.ok) throw new Error("Failed to fetch logs")
      const logsData = await logsRes.json()
      const ids = Array.isArray(logsData) ? logsData.map((l: any) => l.id) : []

      if (ids.length === 0) {
        setSuccess("No archives to delete")
        return
      }

      const delRes = await fetch("/api/admin/logs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logIds: ids }),
      })
      if (!delRes.ok) throw new Error("Failed to delete archives")
      const delJson = await delRes.json()
      setSuccess(`Deleted ${delJson.deletedCount || ids.length} archived log(s)`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete archives")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="text-red-900">Archive & Reset</CardTitle>
        <CardDescription className="text-red-800">
          Manage upload retention and reset daily uploads (archived to logs)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-100 border border-red-300 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-100 border border-green-300 rounded-lg">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Archive uploads</h3>
            <p className="text-sm text-gray-600 mb-3">Move all items from Uploads into the Archive (logs). Use this to manually archive everything.</p>
            <div className="flex gap-2">
              <Button onClick={handleArchiveAllUploads} disabled={isLoading} className="gap-2">
                <Trash2 className="h-4 w-4" />
                {isLoading ? "Processing..." : "Archive uploads"}
              </Button>

              <Button variant="destructive" onClick={handleDeleteAllArchives} disabled={isLoading} className="gap-2">
                {isLoading ? "Processing..." : "Delete archives"}
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  if (!confirm("Delete ALL stored files in the GitHub repo referenced by uploads/logs? This is permanent and cannot be undone.\n\nType 'yes' to confirm.")) return
                  try {
                    setIsLoading(true)
                    setError(null)
                    setSuccess(null)
                    const res = await fetch('/api/admin/delete-github-files', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ confirm: true }),
                    })
                    const json = await res.json()
                    if (!res.ok) throw new Error(json?.error || 'Failed to delete files')
                    setSuccess(json.message || 'Deleted files from GitHub')
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to delete files')
                  } finally {
                    setIsLoading(false)
                  }
                }}
                disabled={isLoading}
                className="gap-2"
              >
                {isLoading ? 'Processing...' : 'Delete all stored files (GitHub)'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
