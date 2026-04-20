import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SetupCharacter, UserProfile } from './types'

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
  activeCoreIndex: number
  setActiveCoreIndex: (i: number) => void
  editMode: boolean
  toggleEditMode: () => void

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
      activeCoreIndex: 0,
      setActiveCoreIndex: (i) => set({ activeCoreIndex: i }),
      editMode: false,
      toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),

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
