import type { UploadResponse, ListFilesResponse, AskResponse } from "@/types"

const API_BASE = "https://pdfragbackend.onrender.com/api"

export class ApiClient {
  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "An error occurred")
    }

    return data
  }

  static async uploadFile(file: File): Promise<UploadResponse> {
    const formData = new FormData()
    formData.append("pdf", file)

    return this.request<UploadResponse>("/upload", {
      method: "POST",
      body: formData,
    })
  }

  static async listFiles(): Promise<ListFilesResponse> {
    return this.request<ListFilesResponse>("/list-files")
  }

  static async deleteFile(filename: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/delete/${encodeURIComponent(filename)}`, {
      method: "DELETE",
    })
  }

  static async askQuestion(question: string): Promise<AskResponse> {
    return this.request<AskResponse>("/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }),
    })
  }
}
