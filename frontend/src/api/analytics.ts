import { useQuery } from '@tanstack/react-query'
import { api } from './client'

export function useTensionCurve(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'analytics', 'tension-curve'],
    queryFn: () => api.get(`/api/stories/${storyId}/analytics/tension-curve`),
    enabled: !!storyId,
  })
}

export function usePacing(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'analytics', 'pacing'],
    queryFn: () => api.get(`/api/stories/${storyId}/analytics/pacing`),
    enabled: !!storyId,
  })
}

export function usePresence(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'analytics', 'presence'],
    queryFn: () => api.get(`/api/stories/${storyId}/analytics/presence`),
    enabled: !!storyId,
  })
}

export function useArcs(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'analytics', 'arcs'],
    queryFn: () => api.get(`/api/stories/${storyId}/analytics/arcs`),
    enabled: !!storyId,
  })
}

export function useHealth(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'analytics', 'health'],
    queryFn: () => api.get(`/api/stories/${storyId}/analytics/health`),
    enabled: !!storyId,
  })
}

export function useSparkline(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'analytics', 'sparkline'],
    queryFn: () => api.get(`/api/stories/${storyId}/analytics/sparkline`),
    enabled: !!storyId,
  })
}
