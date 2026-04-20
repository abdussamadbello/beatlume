import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Collaborator, Comment, ActivityEvent } from '../types'

export function useCollaborators(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'collaborators'],
    queryFn: () => api.get<Collaborator[]>(`/api/stories/${storyId}/collaborators`),
    enabled: !!storyId,
  })
}

export function useComments(storyId: string, sceneId?: string) {
  const qs = sceneId ? `?scene_id=${sceneId}` : ''
  return useQuery({
    queryKey: ['stories', storyId, 'comments', sceneId],
    queryFn: () => api.get<Comment[]>(`/api/stories/${storyId}/comments${qs}`),
    enabled: !!storyId,
  })
}

export function useCreateComment(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { body: string; scene_id?: string }) =>
      api.post<Comment>(`/api/stories/${storyId}/comments`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'comments'] }),
  })
}

export function useActivity(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'activity'],
    queryFn: () => api.get<ActivityEvent[]>(`/api/stories/${storyId}/activity`),
    enabled: !!storyId,
  })
}
