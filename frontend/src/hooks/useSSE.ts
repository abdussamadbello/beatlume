import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useStore } from '../store'
import { api } from '../api/client'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const RECONNECT_DELAY_MS = 1000

interface SSETokenResponse {
  token: string
  expires_in: number
}

export function useSSE(storyId: string) {
  const queryClient = useQueryClient()
  const accessToken = useStore(s => s.accessToken)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (!storyId || !accessToken) return

    let cancelled = false

    const clearReconnect = () => {
      if (reconnectTimeoutRef.current != null) {
        window.clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }

    const closeCurrent = () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    }

    const handleAiComplete = (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      const type = data.type
      if (type === 'insight_generation') {
        queryClient.invalidateQueries({ queryKey: ['stories', storyId, 'insights'] })
        queryClient.invalidateQueries({ queryKey: ['stories', storyId, 'analytics', 'health'] })
      } else if (type === 'prose_continuation') {
        queryClient.invalidateQueries({ queryKey: ['stories', storyId, 'draft'] })
      } else if (type === 'relationship_inference') {
        queryClient.invalidateQueries({ queryKey: ['stories', storyId, 'graph'] })
      } else if (type === 'scene_summarization') {
        queryClient.invalidateQueries({ queryKey: ['stories', storyId, 'scenes'] })
      } else if (type === 'story_scaffolding') {
        queryClient.invalidateQueries({ queryKey: ['stories', storyId, 'scenes'] })
        queryClient.invalidateQueries({ queryKey: ['stories', storyId, 'characters'] })
        queryClient.invalidateQueries({ queryKey: ['stories', storyId, 'graph'] })
      }
    }

    const handleExportComplete = (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      if (data.download_url) {
        window.open(data.download_url, '_blank')
      }
    }

    const handleActivity = () => {
      queryClient.invalidateQueries({ queryKey: ['stories', storyId, 'activity'] })
    }

    const handleComment = () => {
      queryClient.invalidateQueries({ queryKey: ['stories', storyId, 'comments'] })
    }

    const connect = async () => {
      if (cancelled) return
      closeCurrent()

      try {
        const { token } = await api.post<SSETokenResponse>(`/api/stories/${storyId}/events/token`)
        if (cancelled) return

        const url = `${BASE_URL}/api/stories/${storyId}/events?sse_token=${encodeURIComponent(token)}`
        const es = new EventSource(url)
        eventSourceRef.current = es

        es.addEventListener('ai.complete', handleAiComplete)
        es.addEventListener('export.complete', handleExportComplete)
        es.addEventListener('activity', handleActivity)
        es.addEventListener('comment', handleComment)

        es.onerror = () => {
          closeCurrent()
          clearReconnect()
          reconnectTimeoutRef.current = window.setTimeout(connect, RECONNECT_DELAY_MS)
        }
      } catch {
        clearReconnect()
        reconnectTimeoutRef.current = window.setTimeout(connect, RECONNECT_DELAY_MS)
      }
    }

    connect()

    return () => {
      cancelled = true
      clearReconnect()
      closeCurrent()
    }
  }, [storyId, accessToken, queryClient])
}
