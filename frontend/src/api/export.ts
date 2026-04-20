import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from './client'

interface TaskResponse {
  task_id: string
}

export function useTriggerExport(storyId: string) {
  return useMutation({
    mutationFn: (data: { format: string; options?: object }) =>
      api.post<TaskResponse>(`/api/stories/${storyId}/export`, data),
  })
}

export function useExportStatus(storyId: string, jobId: string | null) {
  return useQuery({
    queryKey: ['stories', storyId, 'export', jobId],
    queryFn: () => api.get(`/api/stories/${storyId}/export/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data as Record<string, unknown> | undefined
      if (data?.status === 'completed' || data?.status === 'failed') return false
      return 2000
    },
  })
}
