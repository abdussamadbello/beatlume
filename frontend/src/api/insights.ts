import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Insight, PaginatedResponse } from '../types'

export function useInsights(storyId: string, params?: { category?: string; severity?: string }) {
  const searchParams = new URLSearchParams()
  if (params?.category) searchParams.set('category', params.category)
  if (params?.severity) searchParams.set('severity', params.severity)
  const qs = searchParams.toString()
  return useQuery({
    queryKey: ['stories', storyId, 'insights', params],
    queryFn: () => api.get<PaginatedResponse<Insight>>(`/api/stories/${storyId}/insights${qs ? `?${qs}` : ''}`),
    enabled: !!storyId,
  })
}

export function useDismissInsight(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (insightId: string) => api.put(`/api/stories/${storyId}/insights/${insightId}/dismiss`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'insights'] }),
  })
}
