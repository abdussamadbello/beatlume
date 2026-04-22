import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { CoreConfigNode, ResolvedCoreSetting } from '../types'

export function useCoreTree(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'core', 'tree'],
    queryFn: () => api.get<CoreConfigNode[]>(`/api/stories/${storyId}/core/tree`),
    enabled: !!storyId,
  })
}

export function useCoreSettings(storyId: string, nodeId: string | null | undefined) {
  const qs = nodeId ? `?node_id=${encodeURIComponent(nodeId)}` : ''
  return useQuery({
    queryKey: ['stories', storyId, 'core', 'settings', nodeId ?? null],
    queryFn: () =>
      api.get<ResolvedCoreSetting[]>(`/api/stories/${storyId}/core/settings${qs}`),
    enabled: !!storyId,
  })
}

interface CoreSettingUpdate {
  value?: string
  source?: string
  tag?: string | null
}

export function useUpdateCoreSetting(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      key,
      nodeId,
      ...body
    }: { key: string; nodeId?: string | null } & CoreSettingUpdate) => {
      const qs = nodeId ? `?node_id=${encodeURIComponent(nodeId)}` : ''
      return api.put<unknown>(
        `/api/stories/${storyId}/core/settings/${encodeURIComponent(key)}${qs}`,
        body,
      )
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['stories', storyId, 'core', 'settings'] }),
  })
}

interface CoreSettingCreate {
  key: string
  value: string
  source?: string
  tag?: string | null
  config_node_id?: string | null
}

export function useCreateCoreSetting(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CoreSettingCreate) =>
      api.post<unknown>(`/api/stories/${storyId}/core/settings`, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['stories', storyId, 'core', 'settings'] }),
  })
}
