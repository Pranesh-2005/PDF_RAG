"use client"

import { useState, useCallback } from "react"

export interface Toast {
  id: string
  message: string
  type: "success" | "error" | "warning" | "info"
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = Math.random().toString(36).substr(2, 9)
    const toast: Toast = { id, message, type }

    setToasts((prev) => [...prev, toast])

    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, showToast, removeToast }
}
