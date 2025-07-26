"use client"

import { useState, useEffect, useCallback } from "react"
import type { FileInfo } from "@/types"
import { ApiClient } from "@/lib/api"

export function useFiles() {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await ApiClient.listFiles()
      setFiles(response.files)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files")
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteFile = useCallback(
    async (filename: string) => {
      try {
        await ApiClient.deleteFile(filename)
        await loadFiles() // Refresh the list
        return true
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : "Failed to delete file")
      }
    },
    [loadFiles],
  )

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  return {
    files,
    loading,
    error,
    loadFiles,
    deleteFile,
    hasFiles: files.length > 0,
  }
}
