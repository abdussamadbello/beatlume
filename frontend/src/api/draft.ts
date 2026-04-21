import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from './client'
import type { DraftContent } from '../types'

export function useDraft(storyId: string, sceneId: string | undefined) {
  return useQuery<DraftContent | null>({
    queryKey: ['stories', storyId, 'draft', sceneId],
    queryFn: async () => {
      try {
        return await api.get<DraftContent>(`/api/stories/${storyId}/draft/${sceneId}`)
      } catch (err) {
        // Treat "no draft yet" as empty content rather than an error.
        if (err instanceof ApiError && err.status === 404) return null
        throw err
      }
    },
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
