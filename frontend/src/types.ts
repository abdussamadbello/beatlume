export interface SceneNode {
  id: string; x: number; y: number; label: string; initials: string; type?: 'hub' | 'minor';
}
export interface GraphEdge {
  a: string; b: string; kind: 'conflict' | 'alliance' | 'romance' | 'mentor' | 'secret' | 'family'; weight: number;
}
export interface Scene {
  n: number; title: string; pov: string; tension: number; act: number; location: string; tag: string; summary?: string;
}
export interface Character {
  name: string; role: string; desire: string; flaw: string; sceneCount: number; longestGap: number;
}
export interface Insight {
  severity: 'red' | 'amber' | 'blue'; category: string; title: string; body: string; refs: string[];
}
export interface Act { at: number; label: string; }
export interface Peak { at: number; v: number; label: string; }
export interface ManuscriptChapter { num: string; title: string; paras: string[]; }
export interface CoreConfigNode { depth: number; label: string; kind: 'story' | 'part' | 'chap' | 'scene' | 'beat'; active?: boolean; }
export interface CoreSetting { key: string; value: string; source: string; tag?: string; }
export type EdgeKind = GraphEdge['kind'];
export type TagVariant = 'blue' | 'amber' | 'red' | 'solid';
export type BtnVariant = 'solid' | 'ghost';
export interface SetupCharacter { name: string; role: string; description: string; }
export interface MockStory { id: string; title: string; genre: string; wordCount: number; sceneCount: number; draftNumber: number; lastEdited: string; status: 'in-progress' | 'completed' | 'not-started'; tensionPreview: number[]; }
export interface UserProfile { name: string; email: string; plan: 'free' | 'pro' | 'team'; }
