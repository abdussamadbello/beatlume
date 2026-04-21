import { useQuery } from '@tanstack/react-query'
import type { Act, Peak } from '../types'
import { api } from './client'

export interface TensionCurveMetrics {
  mean: number
  std: number
  max: number
  min: number
  range: number
  climax_position: number
}

export interface TensionCurveResponse {
  points: Array<{ x: number; y: number }>
  raw_points: Array<{ x: number; y: number }>
  peaks: Peak[]
  valleys: Array<{ scene_index: number; tension: number }>
  metrics: TensionCurveMetrics
  data: number[]
  acts: Act[]
}

export function useTensionCurve(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'analytics', 'tension-curve'],
    queryFn: () =>
      api.get<TensionCurveResponse>(
        `/api/stories/${storyId}/analytics/tension-curve`,
      ),
    enabled: !!storyId,
  })
}

export function usePacing(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'analytics', 'pacing'],
    queryFn: () =>
      api.get<unknown>(`/api/stories/${storyId}/analytics/pacing`),
    enabled: !!storyId,
  })
}

export function usePresence(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'analytics', 'presence'],
    queryFn: () =>
      api.get<unknown>(`/api/stories/${storyId}/analytics/presence`),
    enabled: !!storyId,
  })
}

export function useArcs(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'analytics', 'arcs'],
    queryFn: () => api.get<unknown>(`/api/stories/${storyId}/analytics/arcs`),
    enabled: !!storyId,
  })
}

export function useHealth(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'analytics', 'health'],
    queryFn: () =>
      api.get<unknown>(`/api/stories/${storyId}/analytics/health`),
    enabled: !!storyId,
  })
}

export function useSparkline(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'analytics', 'sparkline'],
    queryFn: () =>
      api.get<unknown>(`/api/stories/${storyId}/analytics/sparkline`),
    enabled: !!storyId,
  })
}
