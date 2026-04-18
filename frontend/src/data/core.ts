import type { CoreConfigNode, CoreSetting } from '../types';

export const coreConfigTree: CoreConfigNode[] = [
  { depth: 0, label: 'A Stranger in the Orchard', kind: 'story', active: true },
  { depth: 1, label: 'Part One — Roots', kind: 'part' },
  { depth: 2, label: 'Ch 1 — The Orchard at First Light', kind: 'chap' },
  { depth: 3, label: 'S01 — Orchard at dawn', kind: 'scene', active: true },
  { depth: 3, label: 'S02 — The letter from Col.', kind: 'scene' },
  { depth: 2, label: 'Ch 2 — Wren', kind: 'chap' },
  { depth: 3, label: 'S03 — Wren returns uninvited', kind: 'scene' },
  { depth: 1, label: 'Part Two — Fire', kind: 'part' },
  { depth: 2, label: 'Ch 5 — The Ridge', kind: 'chap' },
  { depth: 3, label: 'S05 — Jon watches from the ridge', kind: 'scene' },
  { depth: 3, label: 'S06 — Kai\'s warning', kind: 'scene' },
  { depth: 1, label: 'Part Three — Ash', kind: 'part' },
  { depth: 2, label: 'Ch 12 — Confession', kind: 'chap' },
];

export const coreSettings: CoreSetting[] = [
  { key: 'Title', value: 'A Stranger in the Orchard', source: 'user' },
  { key: 'Author', value: 'Elena Marsh', source: 'user' },
  { key: 'Genre', value: 'Literary fiction', source: 'user', tag: 'primary' },
  { key: 'POV', value: 'Third-person limited', source: 'user' },
  { key: 'Tense', value: 'Past', source: 'user' },
  { key: 'Draft', value: '3', source: 'system' },
  { key: 'Word count', value: '72,340', source: 'system' },
  { key: 'Scene count', value: '47', source: 'system' },
  { key: 'Chapter count', value: '18', source: 'system' },
  { key: 'Act structure', value: '3-act', source: 'user' },
  { key: 'Time span', value: '14 months', source: 'AI', tag: 'inferred' },
  { key: 'Primary location', value: 'Montana orchard', source: 'AI', tag: 'inferred' },
  { key: 'Protagonist', value: 'Iris', source: 'AI', tag: 'inferred' },
  { key: 'Central conflict', value: 'Land ownership vs. family loyalty', source: 'AI', tag: 'inferred' },
];
