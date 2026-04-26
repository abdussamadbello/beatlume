import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from './client'

interface ExportResponse {
  job_id: string
  status: string
}

export interface ExportJobStatus {
  job_id: string
  status: 'queued' | 'running' | 'completed' | 'failed' | string
  progress: number
  download_url: string | null
  filename: string | null
  error: string | null
  format: string | null
  created_at: number | null
}

interface ExportHistoryResponse {
  items: ExportJobStatus[]
  total: number
}

export function useTriggerExport(storyId: string) {
  return useMutation({
    mutationFn: (data: { format: string; options?: object }) =>
      api.post<ExportResponse>(`/api/stories/${storyId}/export`, data),
  })
}

export function useExportStatus(storyId: string, jobId: string | null) {
  return useQuery<ExportJobStatus>({
    queryKey: ['stories', storyId, 'export', jobId],
    queryFn: () => api.get<ExportJobStatus>(`/api/stories/${storyId}/export/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.status === 'completed' || data?.status === 'failed') return false
      return 2000
    },
  })
}

export function useExportHistory(storyId: string) {
  return useQuery<ExportHistoryResponse>({
    queryKey: ['stories', storyId, 'export', 'history'],
    queryFn: () => api.get<ExportHistoryResponse>(`/api/stories/${storyId}/export`),
  })
}
