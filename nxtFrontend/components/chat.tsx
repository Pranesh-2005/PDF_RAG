"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Send, MessageCircle, Bot, User, Book, Lightbulb } from "lucide-react"
import type { ChatMessage, Source } from "@/types"
import { ApiClient } from "@/lib/api"
import { generateId } from "@/lib/utils"
import { LoadingSpinner } from "./ui/loading"

interface ChatProps {
  hasFiles: boolean
  onShowToast: (message: string, type: "success" | "error") => void
}

export function Chat({ hasFiles, onShowToast }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const addMessage = (content: string, sender: "user" | "ai", sources?: Source[]) => {
    const message: ChatMessage = {
      id: generateId(),
      content,
      sender,
      sources,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, message])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const question = inputValue.trim()
    if (!question || !hasFiles) return

    // Add user message
    addMessage(question, "user")
    setInputValue("")
    setIsLoading(true)

    try {
      const response = await ApiClient.askQuestion(question)
      addMessage(response.answer, "ai", response.sources)
    } catch (error) {
      addMessage(`Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`, "ai")
      onShowToast("Failed to get response", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-blue-600" />
          Chat with your PDFs
        </h2>
      </div>

      <div className="h-96 overflow-y-auto p-6 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="h-12 w-12 text-blue-600 mb-4" />
            <p className="text-gray-600 mb-2">
              {hasFiles ? "I'm ready to answer questions about your PDFs!" : "Upload some PDF files to start chatting"}
            </p>
            {hasFiles && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                <span>Try asking: "What is the main topic?" or "Summarize the key points"</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.sender === "ai" && (
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    message.sender === "user" ? "bg-blue-600 text-white" : "bg-white border border-gray-200"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>

                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Book className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-blue-600">Sources:</span>
                      </div>
                      <div className="space-y-2">
                        {message.sources.map((source, index) => (
                          <div key={index} className="text-sm">
                            <div className="font-medium">
                              {index + 1}. {source.source} (Page {source.page})
                            </div>
                            <div className="text-gray-600 italic mt-1">"{source.content}"</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {message.sender === "user" && (
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    <span className="text-gray-600">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="p-6 border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={hasFiles ? "Ask a question about your PDFs..." : "Upload files to start chatting"}
            disabled={!hasFiles || isLoading}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!hasFiles || !inputValue.trim() || isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLoading ? <LoadingSpinner size="sm" /> : <Send className="h-4 w-4" />}
          </button>
        </form>

        {hasFiles && (
          <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            <span>Try asking: "What is the main topic?" or "Summarize the key points"</span>
          </div>
        )}
      </div>
    </div>
  )
}
