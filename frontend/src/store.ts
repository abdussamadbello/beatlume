import { create } from 'zustand'
import type { Scene, Character, SceneNode, GraphEdge, Insight, ManuscriptChapter, CoreConfigNode, CoreSetting, SetupCharacter, UserProfile } from './types'
import { allScenes, sampleCharacters, sampleNodes, sampleEdges, sampleInsights, coreConfigTree, coreSettings, manuscriptChapters, sceneProse } from './data'

interface BeatLumeState {
  // Auth
  isLoggedIn: boolean
  currentUser: UserProfile
  login: () => void
  logout: () => void
  signup: (name: string, email: string) => void

  // Scenes
  scenes: Scene[]
  addScene: (act: number) => void
  updateScene: (n: number, patch: Partial<Scene>) => void
  deleteScene: (n: number) => void

  // Characters
  characters: Character[]
  addCharacter: (char: Character) => void
  updateCharacter: (name: string, patch: Partial<Character>) => void
  removeCharacter: (name: string) => void

  // Graph
  nodes: SceneNode[]
  edges: GraphEdge[]
  selectedNodeId: string | null
  selectNode: (id: string | null) => void

  // Insights
  insights: Insight[]
  dismissInsight: (index: number) => void

  // Draft
  activeSceneN: number
  setActiveSceneN: (n: number) => void
  draftContent: Record<number, string>
  setDraftContent: (n: number, text: string) => void
  appendDraftContent: (n: number, text: string) => void

  // Core
  coreTree: CoreConfigNode[]
  coreSettings: CoreSetting[]
  activeCoreIndex: number
  setActiveCoreIndex: (i: number) => void

  // Manuscript
  chapters: ManuscriptChapter[]
  editMode: boolean
  toggleEditMode: () => void

  // Setup
  setupCharacters: SetupCharacter[]
  addSetupCharacter: () => void
  updateSetupCharacter: (index: number, patch: Partial<SetupCharacter>) => void
  removeSetupCharacter: (index: number) => void
}

export const useStore = create<BeatLumeState>((set) => ({
  // Auth
  isLoggedIn: false,
  currentUser: { name: 'Elena Marsh', email: 'elena@beatlume.io', plan: 'free' },
  login: () => set({ isLoggedIn: true }),
  logout: () => set({ isLoggedIn: false }),
  signup: (name, email) => set({ isLoggedIn: true, currentUser: { name, email, plan: 'free' } }),

  // Scenes
  scenes: allScenes,
  addScene: (act) => set((s) => {
    const maxN = Math.max(...s.scenes.map(sc => sc.n), 0)
    const newScene: Scene = { n: maxN + 1, title: 'New scene', pov: 'Iris', tension: 3, act, location: 'TBD', tag: 'Draft' }
    return { scenes: [...s.scenes, newScene] }
  }),
  updateScene: (n, patch) => set((s) => ({
    scenes: s.scenes.map(sc => sc.n === n ? { ...sc, ...patch } : sc)
  })),
  deleteScene: (n) => set((s) => ({ scenes: s.scenes.filter(sc => sc.n !== n) })),

  // Characters
  characters: sampleCharacters,
  addCharacter: (char) => set((s) => ({ characters: [...s.characters, char] })),
  updateCharacter: (name, patch) => set((s) => ({
    characters: s.characters.map(c => c.name === name ? { ...c, ...patch } : c)
  })),
  removeCharacter: (name) => set((s) => ({ characters: s.characters.filter(c => c.name !== name) })),

  // Graph
  nodes: sampleNodes,
  edges: sampleEdges,
  selectedNodeId: null,
  selectNode: (id) => set({ selectedNodeId: id }),

  // Insights
  insights: sampleInsights,
  dismissInsight: (index) => set((s) => ({
    insights: s.insights.filter((_, i) => i !== index)
  })),

  // Draft
  activeSceneN: 3,
  setActiveSceneN: (n) => set({ activeSceneN: n }),
  draftContent: sceneProse,
  setDraftContent: (n, text) => set((s) => ({
    draftContent: { ...s.draftContent, [n]: text }
  })),
  appendDraftContent: (n, text) => set((s) => ({
    draftContent: { ...s.draftContent, [n]: (s.draftContent[n] || '') + text }
  })),

  // Core
  coreTree: coreConfigTree,
  coreSettings: coreSettings,
  activeCoreIndex: 9,
  setActiveCoreIndex: (i) => set({ activeCoreIndex: i }),

  // Manuscript
  chapters: manuscriptChapters,
  editMode: false,
  toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),

  // Setup
  setupCharacters: [
    { name: 'Iris', role: 'Protagonist', description: "A widow returning to her family's orchard." },
    { name: 'Cole', role: 'Antagonist', description: 'Her brother-in-law. Wants to sell the land.' },
    { name: 'Wren', role: 'Foil', description: 'Childhood friend who vanished eleven years ago.' },
    { name: 'Kai', role: 'Mentor', description: 'Orchard hand. Keeper of small truths.' },
  ],
  addSetupCharacter: () => set((s) => ({
    setupCharacters: [...s.setupCharacters, { name: '', role: 'Protagonist', description: '' }]
  })),
  updateSetupCharacter: (index, patch) => set((s) => ({
    setupCharacters: s.setupCharacters.map((c, i) => i === index ? { ...c, ...patch } : c)
  })),
  removeSetupCharacter: (index) => set((s) => ({
    setupCharacters: s.setupCharacters.filter((_, i) => i !== index)
  })),
}))
