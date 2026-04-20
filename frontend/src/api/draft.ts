import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { DraftContent } from '../types'

export function useDraft(storyId: string, sceneId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'draft', sceneId],
    queryFn: () => api.get<DraftContent>(`/api/stories/${storyId}/draft/${sceneId}`),
    enabled: !!storyId && !!sceneId,
  })
}

export function useUpdateDraft(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sceneId, content }: { sceneId: string; content: string }) =>
      api.put<DraftContent>(`/api/stories/${storyId}/draft/${sceneId}`, { content }),
    onSuccess: (_, { sceneId }) => qc.invalidateQueries({ queryKey: ['stories', storyId, 'draft', sceneId] }),
  })
}
