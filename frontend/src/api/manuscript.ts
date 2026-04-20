import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { ManuscriptChapter } from '../types'

export function useChapters(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'manuscript'],
    queryFn: () => api.get<ManuscriptChapter[]>(`/api/stories/${storyId}/manuscript`),
    enabled: !!storyId,
  })
}

export function useUpdateChapter(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ num, ...data }: { num: number; title?: string; content?: string }) =>
      api.put<ManuscriptChapter>(`/api/stories/${storyId}/manuscript/${num}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'manuscript'] }),
  })
}
