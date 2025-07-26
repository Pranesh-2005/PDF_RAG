"use client"

import { FileText } from "lucide-react"
import { FileUpload } from "@/components/file-upload"
import { FileList } from "@/components/file-list"
import { Chat } from "@/components/chat"
import { ToastContainer } from "@/components/ui/toast"
import { LoadingOverlay } from "@/components/ui/loading"
import { useFiles } from "@/hooks/useFiles"
import { useToast } from "@/hooks/useToast"
import { useState } from "react"

export default function Home() {
  const { files, loading: filesLoading, loadFiles, deleteFile, hasFiles } = useFiles()
  const { toasts, showToast, removeToast } = useToast()
  const [globalLoading, setGlobalLoading] = useState(false)

  // Wrapper function to handle the return type mismatch
  const handleDeleteFile = async (filename: string): Promise<void> => {
    await deleteFile(filename)
    // Don't return the boolean, convert to void
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <FileText className="h-10 w-10" />
              <h1 className="text-4xl font-bold">Collabrative PDF Chat Assistant</h1>
            </div>
            <p className="text-xl text-blue-100">Upload PDFs and ask questions about their content using AI as a group</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Upload Section */}
          <FileUpload onUploadComplete={loadFiles} onShowToast={showToast} onLoadingChange={setGlobalLoading} />

          {/* Files Section */}
          <FileList
            files={files}
            loading={filesLoading}
            onDeleteFile={handleDeleteFile} // Use wrapper function
            onRefresh={loadFiles}
            onShowToast={showToast}
          />
        </div>

        {/* Chat Section */}
        <div className="w-full">
          <Chat hasFiles={hasFiles} onShowToast={showToast} />
        </div>
      </main>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Loading Overlay */}
      <LoadingOverlay show={globalLoading} />
    </div>
  )
}