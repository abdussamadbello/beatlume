import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Character, PaginatedResponse } from '../types'

export function useCharacters(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'characters'],
    queryFn: () => api.get<PaginatedResponse<Character>>(`/api/stories/${storyId}/characters`),
    enabled: !!storyId,
  })
}

export function useCreateCharacter(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      name: string
      role?: string
      description?: string
      bio?: string
      desire?: string
      flaw?: string
    }) =>
      api.post<Character>(`/api/stories/${storyId}/characters`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'characters'] }),
  })
}

export function useUpdateCharacter(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ characterId, ...data }: { characterId: string } & Partial<Character>) =>
      api.put<Character>(`/api/stories/${storyId}/characters/${characterId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'characters'] }),
  })
}

export function useDeleteCharacter(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (characterId: string) => api.delete(`/api/stories/${storyId}/characters/${characterId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'characters'] }),
  })
}
