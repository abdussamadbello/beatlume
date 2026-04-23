import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AITask, AITaskKind, SetupCharacter, UserProfile } from './types'

const AI_TASK_RETENTION = 25

interface AppState {
  // Auth (persisted to localStorage)
  accessToken: string | null
  currentUser: UserProfile | null
  setAuth: (token: string, user: UserProfile) => void
  clearAuth: () => void

  // UI selections (ephemeral)
  selectedNodeId: string | null
  selectNode: (id: string | null) => void
  activeSceneN: number
  setActiveSceneN: (n: number) => void
  editMode: boolean
  toggleEditMode: () => void

  // AI task monitor (ephemeral, per-session)
  aiTasks: AITask[]
  aiPanelOpen: boolean
  aiPanelLastSeenAt: number
  activeSceneId: string | null
  setActiveSceneId: (id: string | null) => void
  registerAITask: (task_id: string, kind: AITaskKind, scene_id?: string) => void
  updateAITask: (task_id: string, patch: Partial<AITask>) => void
  appendAITaskChunk: (task_id: string, text: string, kind?: AITaskKind, scene_id?: string) => void
  recordAITaskLaunchError: (kind: AITaskKind, message: string) => void
  clearCompletedAITasks: () => void
  toggleAIPanel: () => void
  setAIPanelOpen: (open: boolean) => void

  // Setup wizard (ephemeral)
  setupCharacters: SetupCharacter[]
  addSetupCharacter: () => void
  updateSetupCharacter: (index: number, patch: Partial<SetupCharacter>) => void
  removeSetupCharacter: (index: number) => void
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Auth
      accessToken: null,
      currentUser: null,
      setAuth: (token, user) => set({ accessToken: token, currentUser: user }),
      clearAuth: () => set({ accessToken: null, currentUser: null }),

      // UI
      selectedNodeId: null,
      selectNode: (id) => set({ selectedNodeId: id }),
      activeSceneN: 1,
      setActiveSceneN: (n) => set({ activeSceneN: n }),
      editMode: false,
      toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),

      // AI task monitor
      aiTasks: [],
      aiPanelOpen: false,
      aiPanelLastSeenAt: 0,
      activeSceneId: null,
      setActiveSceneId: (id) => set({ activeSceneId: id }),
      registerAITask: (task_id, kind, scene_id) => set((s) => {
        if (s.aiTasks.some((t) => t.task_id === task_id)) return {}
        const next: AITask = { task_id, kind, status: 'queued', started_at: Date.now(), scene_id }
        return { aiTasks: [next, ...s.aiTasks].slice(0, AI_TASK_RETENTION) }
      }),
      appendAITaskChunk: (task_id, text, kind, scene_id) => set((s) => {
        const idx = s.aiTasks.findIndex((t) => t.task_id === task_id)
        if (idx === -1) {
          if (!kind) return {}
          const next: AITask = {
            task_id,
            kind,
            status: 'running',
            started_at: Date.now(),
            streaming_text: text,
            chunk_count: 1,
            scene_id,
          }
          return { aiTasks: [next, ...s.aiTasks].slice(0, AI_TASK_RETENTION) }
        }
        const prev = s.aiTasks[idx]
        const merged: AITask = {
          ...prev,
          status: prev.status === 'queued' ? 'running' : prev.status,
          streaming_text: (prev.streaming_text ?? '') + text,
          chunk_count: (prev.chunk_count ?? 0) + 1,
          scene_id: prev.scene_id ?? scene_id,
        }
        const aiTasks = [...s.aiTasks]
        aiTasks[idx] = merged
        return { aiTasks }
      }),
      recordAITaskLaunchError: (kind, message) => set((s) => {
        const synthetic: AITask = {
          task_id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          kind,
          status: 'error',
          started_at: Date.now(),
          completed_at: Date.now(),
          error: message,
        }
        return { aiTasks: [synthetic, ...s.aiTasks].slice(0, AI_TASK_RETENTION) }
      }),
      updateAITask: (task_id, patch) => set((s) => {
        const idx = s.aiTasks.findIndex((t) => t.task_id === task_id)
        if (idx === -1) {
          if (!patch.kind) return {}
          const next: AITask = {
            task_id,
            kind: patch.kind,
            status: patch.status ?? 'running',
            started_at: patch.started_at ?? Date.now(),
            completed_at: patch.completed_at,
            error: patch.error,
            scene_id: patch.scene_id,
            progress_current: patch.progress_current,
            progress_total: patch.progress_total,
            scene_n: patch.scene_n,
          }
          return { aiTasks: [next, ...s.aiTasks].slice(0, AI_TASK_RETENTION) }
        }
        const merged = { ...s.aiTasks[idx], ...patch }
        const aiTasks = [...s.aiTasks]
        aiTasks[idx] = merged
        return { aiTasks }
      }),
      clearCompletedAITasks: () => set((s) => ({
        aiTasks: s.aiTasks.filter((t) => t.status === 'queued' || t.status === 'running'),
      })),
      toggleAIPanel: () => set((s) => ({
        aiPanelOpen: !s.aiPanelOpen,
        aiPanelLastSeenAt: !s.aiPanelOpen ? Date.now() : s.aiPanelLastSeenAt,
      })),
      setAIPanelOpen: (open) => set((s) => ({
        aiPanelOpen: open,
        aiPanelLastSeenAt: open ? Date.now() : s.aiPanelLastSeenAt,
      })),

      // Setup
      setupCharacters: [
        { name: '', role: 'Protagonist', description: '' },
      ],
      addSetupCharacter: () => set((s) => ({
        setupCharacters: [...s.setupCharacters, { name: '', role: 'Protagonist', description: '' }],
      })),
      updateSetupCharacter: (index, patch) => set((s) => ({
        setupCharacters: s.setupCharacters.map((c, i) => i === index ? { ...c, ...patch } : c),
      })),
      removeSetupCharacter: (index) => set((s) => ({
        setupCharacters: s.setupCharacters.filter((_, i) => i !== index),
      })),
    }),
    {
      name: 'beatlume-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        currentUser: state.currentUser,
      }),
    },
  ),
)
