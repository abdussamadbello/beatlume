import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Scene, PaginatedResponse } from '../types'

export function useScenes(storyId: string, params?: { act?: number; pov?: string; sort?: string }) {
  const searchParams = new URLSearchParams()
  if (params?.act) searchParams.set('act', String(params.act))
  if (params?.pov) searchParams.set('pov', params.pov)
  if (params?.sort) searchParams.set('sort', params.sort)
  const qs = searchParams.toString()
  return useQuery({
    queryKey: ['stories', storyId, 'scenes', params],
    queryFn: () => api.get<PaginatedResponse<Scene>>(`/api/stories/${storyId}/scenes${qs ? `?${qs}` : ''}`),
    enabled: !!storyId,
  })
}

export function useScene(storyId: string, sceneId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'scenes', sceneId],
    queryFn: () => api.get<Scene>(`/api/stories/${storyId}/scenes/${sceneId}`),
    enabled: !!storyId && !!sceneId,
  })
}

export function useCreateScene(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; pov?: string; tension?: number; act?: number; location?: string; tag?: string }) =>
      api.post<Scene>(`/api/stories/${storyId}/scenes`, data),
    onSuccess: () => qc.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey
        return key[0] === 'stories' && key[1] === storyId && key[2] === 'scenes' && typeof key[3] !== 'string'
      },
    }),
  })
}

export interface SceneParticipantWrite {
  character_id: string
  role?: string
  interaction_weight?: number | null
}

export interface SceneUpdatePayload {
  title?: string
  pov?: string
  tension?: number
  act?: number
  location?: string
  tag?: string
  summary?: string | null
  chapter_id?: string | null
  participants?: SceneParticipantWrite[]
}

export function useUpdateScene(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sceneId, ...data }: { sceneId: string } & SceneUpdatePayload) =>
      api.put<Scene>(`/api/stories/${storyId}/scenes/${sceneId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'scenes'] }),
  })
}

export function useDeleteScene(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sceneId: string) => api.delete(`/api/stories/${storyId}/scenes/${sceneId}`),
    onSuccess: () => qc.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey
        return key[0] === 'stories' && key[1] === storyId && key[2] === 'scenes' && typeof key[3] !== 'string'
      },
    }),
  })
}
