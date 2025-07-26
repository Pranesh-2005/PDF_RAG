export interface FileInfo {
  name: string
  size: number
  time_remaining?: number
}

export interface ChatMessage {
  id: string
  content: string
  sender: "user" | "ai"
  sources?: Source[]
  timestamp: Date
}

export interface Source {
  source: string
  page: number
  content: string
}

export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  error?: string
  data?: T
}

export interface UploadResponse {
  message: string
  auto_delete_in: number
}

export interface ListFilesResponse {
  files: FileInfo[]
}

export interface AskResponse {
  answer: string
  sources?: Source[]
}
