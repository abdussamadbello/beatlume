// --- Story ---
export interface Story {
  id: string
  title: string
  logline: string
  genres: string[]
  subgenre: string
  themes: string[]
  target_words: number
  draft_number: number
  status: 'not_started' | 'in_progress' | 'completed'
  structure_type: string
  archived: boolean
}

// --- Scene ---
export interface SceneParticipant {
  id: string
  scene_id: string
  character_id: string
  role: string
  interaction_weight?: number | null
}

export interface Scene {
  id: string
  story_id: string
  chapter_id?: string | null
  n: number
  title: string
  pov: string
  tension: number
  act: number
  location: string
  tag: string
  summary?: string
  participants?: SceneParticipant[]
  emotional: number
  stakes: number
  mystery: number
  romance: number
  danger: number
  hope: number
}

export const SCENE_METRICS = ['emotional', 'stakes', 'mystery', 'romance', 'danger', 'hope'] as const
export type SceneMetric = typeof SCENE_METRICS[number]

// --- Beat ---
export interface Beat {
  id: string
  scene_id: string
  n: number
  title: string
  kind: string
  summary?: string | null
}

export const BEAT_KINDS = ['setup', 'action', 'reaction', 'decision', 'reveal', 'turn'] as const
export type BeatKind = typeof BEAT_KINDS[number]

// --- Character ---
export interface Character {
  id: string
  story_id: string
  name: string
  role: string
  archetype: string
  description: string
  bio: string
  desire: string
  fear: string
  flaw: string
  arc_summary: string
  relationship_notes: string
  scene_count: number
  longest_gap: number
}

// --- Graph ---
export interface SceneNode {
  id: string
  character_id: string
  x: number
  y: number
  label: string
  initials: string
  node_type?: 'hub' | 'minor'
  first_appearance_scene: number
}

export interface GraphEdge {
  id: string
  source_node_id: string
  target_node_id: string
  kind: EdgeKind
  weight: number
  provenance: 'author' | 'ai_accepted' | 'ai_pending' | 'scaffold'
  evidence: Array<{ scene_n: number; type: string }>
  first_evidenced_scene: number
}

export type EdgeKind = 'conflict' | 'alliance' | 'romance' | 'mentor' | 'secret' | 'family'

// --- Insight ---
export interface Insight {
  id: string
  severity: 'red' | 'amber' | 'blue'
  category: string
  title: string
  body: string
  refs: string[]
  dismissed: boolean
}

// --- Draft ---
export interface DraftContent {
  id: string
  scene_id: string
  content: string
  word_count: number
}

// --- Chapter + Scene planning (stored as core_settings on their tree node) ---
export interface CoreConfigNode {
  id: string
  parent_id: string | null
  depth: number
  label: string
  kind: 'story' | 'part' | 'chap' | 'scene' | 'beat'
  active: boolean
  sort_order: number
}

export interface ResolvedCoreSetting {
  key: string
  value: string
  source: string
  tag?: string | null
  defined_at_node_id: string | null
  defined_at_label: string
  is_override: boolean
}

// --- Manuscript ---
export interface ManuscriptChapter {
  id: string
  num: number
  title: string
  content: string
  sort_order: number
}

// --- Collaboration ---
export interface Collaborator {
  id: string
  user_id: string
  user_name?: string | null
  user_email?: string | null
  role: 'author' | 'editor' | 'reader'
  invited_at: string
  accepted_at?: string
}

export interface Comment {
  id: string
  user_id: string
  user_name?: string | null
  scene_id?: string
  body: string
  created_at: string
}

export interface ActivityEvent {
  id: string
  user_id: string
  user_name?: string | null
  action: string
  detail: Record<string, unknown>
  created_at: string
}

// --- Export ---
export interface ExportJob {
  id: string
  format: 'pdf' | 'docx' | 'epub' | 'plaintext'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  file_key?: string
  error?: string
  created_at: string
  completed_at?: string
}

// --- User ---
export interface UserProfile {
  id: string
  email: string
  name: string
  avatar_url?: string
  plan: 'free' | 'pro' | 'team'
}

// --- Misc ---
export interface Act { at: number; label: string }
export interface Peak { at: number; v: number; label: string }
export interface SetupCharacter { name: string; role: string; description: string }
export type TagVariant = 'blue' | 'amber' | 'red' | 'solid'
export type BtnVariant = 'solid' | 'ghost'

// --- API Response ---
export interface PaginatedResponse<T> {
  items: T[]
  total: number
}
