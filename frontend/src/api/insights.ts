import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Insight, PaginatedResponse } from '../types'

export type InsightScope = 'active' | 'dismissed' | 'all'

export function useInsights(
  storyId: string,
  params?: { category?: string; severity?: string; scope?: InsightScope },
) {
  const scope = params?.scope ?? 'active'
  const searchParams = new URLSearchParams()
  if (params?.category) searchParams.set('category', params.category)
  if (params?.severity) searchParams.set('severity', params.severity)
  if (scope === 'dismissed') searchParams.set('only_dismissed', 'true')
  if (scope === 'all') searchParams.set('include_dismissed', 'true')
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

export function useRestoreInsight(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (insightId: string) => api.put(`/api/stories/${storyId}/insights/${insightId}/restore`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'insights'] }),
  })
}
