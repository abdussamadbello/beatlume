import type { SceneNode, GraphEdge } from '../types';

export const sampleNodes: SceneNode[] = [
  { id: 'iris', x: 320, y: 200, label: 'Iris', initials: 'IR', type: 'hub' },
  { id: 'wren', x: 180, y: 120, label: 'Wren', initials: 'WR' },
  { id: 'cole', x: 460, y: 120, label: 'Cole', initials: 'CO' },
  { id: 'jon', x: 180, y: 300, label: 'Jon', initials: 'JN' },
  { id: 'mara', x: 460, y: 300, label: 'Mara', initials: 'MA' },
  { id: 'kai', x: 120, y: 210, label: 'Kai', initials: 'KA' },
  { id: 'fen', x: 520, y: 210, label: 'Fen', initials: 'FN', type: 'minor' },
  { id: 'doc', x: 320, y: 380, label: 'Doc', initials: 'DC', type: 'minor' },
  { id: 'sib', x: 400, y: 380, label: 'Sib', initials: 'SB', type: 'minor' },
];

export const sampleEdges: GraphEdge[] = [
  { a: 'iris', b: 'wren', kind: 'family', weight: 2 },
  { a: 'iris', b: 'cole', kind: 'conflict', weight: 3 },
  { a: 'iris', b: 'jon', kind: 'romance', weight: 2 },
  { a: 'iris', b: 'mara', kind: 'family', weight: 2 },
  { a: 'iris', b: 'kai', kind: 'mentor', weight: 2 },
  { a: 'wren', b: 'cole', kind: 'conflict', weight: 1 },
  { a: 'wren', b: 'jon', kind: 'alliance', weight: 1 },
  { a: 'cole', b: 'mara', kind: 'secret', weight: 2 },
  { a: 'cole', b: 'fen', kind: 'alliance', weight: 1 },
  { a: 'jon', b: 'doc', kind: 'alliance', weight: 1 },
  { a: 'mara', b: 'sib', kind: 'family', weight: 1 },
  { a: 'fen', b: 'doc', kind: 'secret', weight: 1 },
];
