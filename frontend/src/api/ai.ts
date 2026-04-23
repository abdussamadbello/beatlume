import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { useStore } from '../store'
import type { AITaskKind } from '../types'

interface TaskResponse {
  task_id: string
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Request failed'
}

function onError(kind: AITaskKind) {
  return (err: unknown) => {
    useStore.getState().recordAITaskLaunchError(kind, errorMessage(err))
  }
}

function onSuccess(kind: AITaskKind, getSceneId?: () => string | undefined) {
  return (data: TaskResponse) => {
    useStore.getState().registerAITask(data.task_id, kind, getSceneId?.())
  }
}

export function useTriggerInsights(storyId: string) {
  return useMutation({
    mutationFn: () => api.post<TaskResponse>(`/api/stories/${storyId}/insights/generate`),
    onSuccess: onSuccess('insight_generation'),
    onError: onError('insight_generation'),
  })
}

export function useTriggerApplyInsight(storyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (insightId: string) =>
      api.post<TaskResponse>(`/api/stories/${storyId}/insights/${insightId}/apply`),
    onSuccess: (res) => {
      onSuccess('insight_apply')(res)
      void queryClient.invalidateQueries({ queryKey: ['stories', storyId, 'insights'] })
    },
    onError: onError('insight_apply'),
  })
}

export function useTriggerProseContinue(storyId: string) {
  return useMutation({
    mutationFn: (sceneId: string) =>
      api.post<TaskResponse>(`/api/stories/${storyId}/draft/${sceneId}/ai-continue`),
    onSuccess: (data, sceneId) => {
      useStore.getState().registerAITask(data.task_id, 'prose_continuation', sceneId)
    },
    onError: onError('prose_continuation'),
  })
}

export function useTriggerRelationships(storyId: string) {
  return useMutation({
    mutationFn: () => api.post<TaskResponse>(`/api/stories/${storyId}/ai/relationships`),
    onSuccess: onSuccess('relationship_inference'),
    onError: onError('relationship_inference'),
  })
}

export function useTriggerSummarize(storyId: string) {
  return useMutation({
    mutationFn: (sceneId: string) =>
      api.post<TaskResponse>(`/api/stories/${storyId}/ai/summarize/${sceneId}`),
    onSuccess: (data, sceneId) => {
      useStore.getState().registerAITask(data.task_id, 'scene_summarization', sceneId)
    },
    onError: onError('scene_summarization'),
  })
}

export type ScaffoldPayload = {
  premise: string
  structure_type?: string
  target_words?: number
  genres?: string[]
  characters?: object[]
  replace_existing?: boolean
}

export function useTriggerScaffold(storyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ScaffoldPayload) => api.post<TaskResponse>(`/api/stories/${storyId}/ai/scaffold`, data),
    onSuccess: (res) => {
      onSuccess('story_scaffolding')(res)
      void queryClient.invalidateQueries({ queryKey: ['stories', storyId, 'scenes'] })
      void queryClient.invalidateQueries({ queryKey: ['stories', storyId, 'characters'] })
      void queryClient.invalidateQueries({ queryKey: ['stories', storyId, 'graph'] })
      void queryClient.invalidateQueries({ queryKey: ['stories', storyId, 'analytics'] })
    },
    onError: onError('story_scaffolding'),
  })
}

export type GenerateManuscriptPayload = {
  skip_non_empty?: boolean
  max_scenes?: number | null
  act?: number | null
  /** Only draft scenes with scene number >= this (resume long runs). */
  min_scene_n?: number | null
}

export function useTriggerGenerateManuscript(storyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: GenerateManuscriptPayload = {}) =>
      api.post<TaskResponse>(`/api/stories/${storyId}/ai/generate-manuscript`, {
        skip_non_empty: data.skip_non_empty ?? true,
        max_scenes: data.max_scenes ?? null,
        act: data.act ?? null,
        min_scene_n: data.min_scene_n ?? null,
      }),
    onSuccess: (res) => {
      onSuccess('full_manuscript')(res)
      void queryClient.invalidateQueries({ queryKey: ['stories', storyId, 'scenes'] })
    },
    onError: onError('full_manuscript'),
  })
}
