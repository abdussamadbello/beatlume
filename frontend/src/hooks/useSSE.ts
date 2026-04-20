import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useStore } from '../store'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function useSSE(storyId: string) {
  const queryClient = useQueryClient()
  const accessToken = useStore(s => s.accessToken)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!storyId || !accessToken) return

    const url = `${BASE_URL}/api/stories/${storyId}/events?token=${accessToken}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.addEventListener('ai.complete', (e) => {
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
    })

    es.addEventListener('export.complete', (e) => {
      const data = JSON.parse(e.data)
      if (data.download_url) {
        window.open(data.download_url, '_blank')
      }
    })

    es.addEventListener('activity', () => {
      queryClient.invalidateQueries({ queryKey: ['stories', storyId, 'activity'] })
    })

    es.addEventListener('comment', () => {
      queryClient.invalidateQueries({ queryKey: ['stories', storyId, 'comments'] })
    })

    es.onerror = () => {
      // EventSource auto-reconnects by default
    }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [storyId, accessToken, queryClient])
}
