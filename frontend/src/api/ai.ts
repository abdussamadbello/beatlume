import { useMutation } from '@tanstack/react-query'
import { api } from './client'

interface TaskResponse {
  task_id: string
}

export function useTriggerInsights(storyId: string) {
  return useMutation({
    mutationFn: () => api.post<TaskResponse>(`/api/stories/${storyId}/insights/generate`),
  })
}

export function useTriggerProseContinue(storyId: string) {
  return useMutation({
    mutationFn: (sceneId: string) =>
      api.post<TaskResponse>(`/api/stories/${storyId}/draft/${sceneId}/ai-continue`),
  })
}

export function useTriggerRelationships(storyId: string) {
  return useMutation({
    mutationFn: () => api.post<TaskResponse>(`/api/stories/${storyId}/ai/relationships`),
  })
}

export function useTriggerSummarize(storyId: string) {
  return useMutation({
    mutationFn: (sceneId: string) =>
      api.post<TaskResponse>(`/api/stories/${storyId}/ai/summarize/${sceneId}`),
  })
}

export function useTriggerScaffold(storyId: string) {
  return useMutation({
    mutationFn: (data: { premise: string; structure_type?: string; target_words?: number; genres?: string[]; characters?: object[] }) =>
      api.post<TaskResponse>(`/api/stories/${storyId}/ai/scaffold`, data),
  })
}
