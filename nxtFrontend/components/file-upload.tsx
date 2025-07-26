"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Upload, Plus, FileText, X } from "lucide-react"
import { ApiClient } from "@/lib/api"
import { formatFileSize } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface FileUploadProps {
  onUploadComplete: () => void
  onShowToast: (message: string, type: "success" | "error" | "warning") => void
  onLoadingChange: (loading: boolean) => void
}

export function FileUpload({ onUploadComplete, onShowToast, onLoadingChange }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files) return

      const pdfFiles = Array.from(files).filter((file) => file.type === "application/pdf")

      if (pdfFiles.length !== files.length) {
        onShowToast("Only PDF files are allowed", "warning")
      }

      setSelectedFiles(pdfFiles)
    },
    [onShowToast],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      handleFileSelect(e.dataTransfer.files)
    },
    [handleFileSelect],
  )

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const uploadFiles = useCallback(async () => {
    if (selectedFiles.length === 0) {
      onShowToast("Please select at least one file", "error")
      return
    }

    onLoadingChange(true)
    let successCount = 0
    let errorCount = 0

    for (const file of selectedFiles) {
      try {
        const result = await ApiClient.uploadFile(file)
        successCount++
        onShowToast(`${result.message} (Auto-delete in ${result.auto_delete_in} minutes)`, "success")
      } catch (error) {
        errorCount++
        onShowToast(
          `Failed to upload ${file.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
          "error",
        )
      }
    }

    setSelectedFiles([])
    onLoadingChange(false)
    onUploadComplete()

    if (successCount > 0) {
      onShowToast(`Successfully uploaded ${successCount} file(s)`, "success")
    }
  }, [selectedFiles, onLoadingChange, onShowToast, onUploadComplete])

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Upload className="h-5 w-5 text-blue-600" />
          Upload PDF Files
        </h2>
        <p className="text-gray-600">Upload your PDF documents to start asking questions</p>
      </div>

      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
          dragOver
            ? "border-blue-500 bg-blue-50"
            : selectedFiles.length > 0
              ? "border-green-500 bg-green-50"
              : "border-gray-300 hover:border-gray-400 hover:bg-gray-50",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />

        {selectedFiles.length === 0 ? (
          <>
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Upload PDF Files</h3>
            <p className="text-gray-600 mb-4">Drag and drop files here or click to browse</p>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Choose Files
            </button>
          </>
        ) : (
          <>
            <FileText className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-4">{selectedFiles.length} file(s) selected</h3>
            <div className="space-y-2 mb-4">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(index)
                    }}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
            >
              <Plus className="h-4 w-4" />
              Choose Different Files
            </button>
          </>
        )}
      </div>

      <button
        onClick={uploadFiles}
        disabled={selectedFiles.length === 0}
        className="w-full mt-4 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        <Upload className="h-4 w-4" />
        Upload Files
      </button>
    </div>
  )
}
