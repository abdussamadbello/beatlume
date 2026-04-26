import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Story, PaginatedResponse } from '../types'

export type StoryListScope = 'active' | 'archived' | 'all'

export function useStories(scope: StoryListScope = 'active') {
  const qs = scope === 'archived' ? '?only_archived=true'
    : scope === 'all' ? '?include_archived=true'
    : ''
  return useQuery({
    queryKey: ['stories', { scope }],
    queryFn: () => api.get<PaginatedResponse<Story>>(`/api/stories${qs}`),
  })
}

export function useStory(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId],
    queryFn: () => api.get<Story>(`/api/stories/${storyId}`),
    enabled: !!storyId,
  })
}

export function useCreateStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      title: string
      logline?: string
      genres?: string[]
      subgenre?: string
      themes?: string[]
      target_words?: number
      structure_type?: string
      story_type?: string
    }) => api.post<Story>('/api/stories', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories'] }),
  })
}

export function useUpdateStory(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Story>) => api.put<Story>(`/api/stories/${storyId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stories', storyId] })
      qc.invalidateQueries({ queryKey: ['stories'] })
    },
  })
}

export function useDeleteStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (storyId: string) => api.delete(`/api/stories/${storyId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories'] }),
  })
}

export function useDuplicateStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (storyId: string) =>
      api.post<Story>(`/api/stories/${storyId}/duplicate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories'] }),
  })
}
