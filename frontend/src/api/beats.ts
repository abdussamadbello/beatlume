import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Beat } from '../types'

const beatsKey = (storyId: string, sceneId: string) =>
  ['stories', storyId, 'scenes', sceneId, 'beats'] as const

const beatsUrl = (storyId: string, sceneId: string) =>
  `/api/stories/${storyId}/scenes/${sceneId}/beats`

export function useBeats(storyId: string, sceneId: string) {
  return useQuery({
    queryKey: beatsKey(storyId, sceneId),
    queryFn: () => api.get<Beat[]>(beatsUrl(storyId, sceneId)),
    enabled: !!storyId && !!sceneId,
  })
}

export interface BeatCreatePayload {
  title?: string
  kind?: string
  summary?: string | null
}

export function useCreateBeat(storyId: string, sceneId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BeatCreatePayload) =>
      api.post<Beat>(beatsUrl(storyId, sceneId), data),
    onSuccess: () => qc.invalidateQueries({ queryKey: beatsKey(storyId, sceneId) }),
  })
}

export interface BeatUpdatePayload {
  title?: string
  kind?: string
  summary?: string | null
  n?: number
}

export function useUpdateBeat(storyId: string, sceneId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ beatId, ...data }: { beatId: string } & BeatUpdatePayload) =>
      api.put<Beat>(`${beatsUrl(storyId, sceneId)}/${beatId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: beatsKey(storyId, sceneId) }),
  })
}

export function useDeleteBeat(storyId: string, sceneId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (beatId: string) =>
      api.delete(`${beatsUrl(storyId, sceneId)}/${beatId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: beatsKey(storyId, sceneId) }),
  })
}

export function useReorderBeats(storyId: string, sceneId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ordered_ids: string[]) =>
      api.patch<Beat[]>(`${beatsUrl(storyId, sceneId)}/reorder`, { ordered_ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: beatsKey(storyId, sceneId) }),
  })
}
