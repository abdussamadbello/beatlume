import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { CoreConfigNode, CoreSetting } from '../types'

export function useCoreTree(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'core', 'tree'],
    queryFn: () => api.get<CoreConfigNode[]>(`/api/stories/${storyId}/core/tree`),
    enabled: !!storyId,
  })
}

export function useCoreSettings(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'core', 'settings'],
    queryFn: () => api.get<CoreSetting[]>(`/api/stories/${storyId}/core/settings`),
    enabled: !!storyId,
  })
}

export function useUpdateCoreSetting(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      api.put<CoreSetting>(`/api/stories/${storyId}/core/settings/${key}`, { value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'core', 'settings'] }),
  })
}
