"use client"

import { useState } from "react"
import { FolderOpen, FileText, Trash2, RefreshCw } from "lucide-react"
import type { FileInfo } from "@/types"
import { formatFileSize } from "@/lib/utils"
import { LoadingSpinner } from "./ui/loading"

interface FileListProps {
  files: FileInfo[]
  loading: boolean
  onDeleteFile: (filename: string) => Promise<void>
  onRefresh: () => void
  onShowToast: (message: string, type: "success" | "error") => void
}

export function FileList({ files, loading, onDeleteFile, onRefresh, onShowToast }: FileListProps) {
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set())

  const handleDelete = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return

    setDeletingFiles((prev) => new Set(prev).add(filename))

    try {
      await onDeleteFile(filename)
      onShowToast("File deleted successfully", "success")
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : "Failed to delete file", "error")
    } finally {
      setDeletingFiles((prev) => {
        const newSet = new Set(prev)
        newSet.delete(filename)
        return newSet
      })
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-blue-600" />
          Uploaded Files
        </h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {loading && files.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
            <span className="ml-2 text-gray-600">Loading files...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No files uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {files.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      Size: {formatFileSize(file.size)} | Time left:{" "}
                      {file.time_remaining ? `${file.time_remaining} min` : "Expires soon"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(file.name)}
                  disabled={deletingFiles.has(file.name)}
                  className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingFiles.has(file.name) ? <LoadingSpinner size="sm" /> : <Trash2 className="h-4 w-4" />}
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
