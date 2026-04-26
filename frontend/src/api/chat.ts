import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { useStore } from '../store'
import type { ChatMessage, ChatThread } from '../types'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface ListResponse<T> {
  items: T[]
  total: number
}

export function chatThreadsKey(storyId: string) {
  return ['chat', 'threads', storyId] as const
}

export function chatMessagesKey(threadId: string) {
  return ['chat', 'messages', threadId] as const
}

export function useChatThreads(storyId: string) {
  return useQuery({
    queryKey: chatThreadsKey(storyId),
    queryFn: () => api.get<ListResponse<ChatThread>>(`/api/stories/${storyId}/chat/threads`),
  })
}

export function useChatMessages(threadId: string | null) {
  return useQuery({
    enabled: Boolean(threadId),
    queryKey: chatMessagesKey(threadId ?? ''),
    queryFn: () => api.get<ListResponse<ChatMessage>>(`/api/chat/threads/${threadId}/messages`),
  })
}

export function useCreateChatThread(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (title?: string) =>
      api.post<ChatThread>(`/api/stories/${storyId}/chat/threads`, { title: title ?? null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatThreadsKey(storyId) })
    },
  })
}

export function useArchiveChatThread(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (threadId: string) => api.delete(`/api/chat/threads/${threadId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatThreadsKey(storyId) })
    },
  })
}

export function useApplyToolCall() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (messageId: string) =>
      api.post<{ applied: boolean }>(`/api/chat/tool_calls/${messageId}/apply`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat'] }),
  })
}

export function useRejectToolCall() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ messageId, reason }: { messageId: string; reason?: string }) =>
      api.post<{ rejected: boolean }>(`/api/chat/tool_calls/${messageId}/reject`, {
        reason: reason ?? null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat'] }),
  })
}

/**
 * Streams the assistant response via SSE. Returns an async generator of `{type, data}` events.
 *
 * Bypasses the `api` helper because we need the raw Response stream — but mirrors its
 * auth approach: token from Zustand, BASE_URL from env, credentials: 'include'.
 */
export async function* sendChatMessageStream(
  threadId: string,
  content: string,
  activeSceneId: string | null,
): AsyncGenerator<{ type: string; data: unknown }> {
  const accessToken = useStore.getState().accessToken
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const res = await fetch(`${BASE_URL}/api/chat/threads/${threadId}/messages`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ content, active_scene_id: activeSceneId }),
  })
  if (!res.ok || !res.body) {
    throw new Error(`send failed: ${res.status} ${await res.text().catch(() => '')}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE events are delimited by blank lines (\n\n)
    let sep = buffer.indexOf('\n\n')
    while (sep !== -1) {
      const raw = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      sep = buffer.indexOf('\n\n')

      const lines = raw.split('\n')
      let eventType = 'message'
      let dataLine = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) eventType = line.slice(7).trim()
        else if (line.startsWith('data: ')) dataLine = line.slice(6)
      }
      if (dataLine) {
        try {
          yield { type: eventType, data: JSON.parse(dataLine) }
        } catch {
          // Skip malformed events rather than crashing the whole stream
        }
      }
    }
  }
}
