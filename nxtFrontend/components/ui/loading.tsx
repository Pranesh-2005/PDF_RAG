"use client"

import { Loader2 } from "lucide-react"

interface LoadingOverlayProps {
  show: boolean
  message?: string
}

export function LoadingOverlay({ show, message = "Processing..." }: LoadingOverlayProps) {
  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <p className="text-gray-700 font-medium">{message}</p>
        </div>
      </div>
    </div>
  )
}

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  }

  return <Loader2 className={`animate-spin ${sizeClasses[size]} ${className}`} />
}
