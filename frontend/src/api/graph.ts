import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { SceneNode, GraphEdge } from '../types'

interface GraphResponse {
  nodes: SceneNode[]
  edges: GraphEdge[]
}

export function useGraph(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'graph'],
    queryFn: () => api.get<GraphResponse>(`/api/stories/${storyId}/graph`),
    enabled: !!storyId,
  })
}

export function useUpdateNode(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ nodeId, ...data }: { nodeId: string; x?: number; y?: number }) =>
      api.put<SceneNode>(`/api/stories/${storyId}/graph/nodes/${nodeId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'graph'] }),
  })
}

export function useCreateEdge(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { source_node_id: string; target_node_id: string; kind: string; weight?: number }) =>
      api.post<GraphEdge>(`/api/stories/${storyId}/graph/edges`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'graph'] }),
  })
}

export function useDeleteEdge(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (edgeId: string) => api.delete(`/api/stories/${storyId}/graph/edges/${edgeId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'graph'] }),
  })
}
