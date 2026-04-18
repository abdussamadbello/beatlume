import type { Insight } from '../types';

export const sampleInsights: Insight[] = [
  {
    severity: 'red',
    category: 'Continuity',
    title: 'Mara referenced after death without setup',
    body: 'Mara is mentioned in S23 as having written a letter, but her death is not established until S19. Readers may be confused by the chronology.',
    refs: ['S19', 'S23'],
  },
  {
    severity: 'red',
    category: 'Pacing',
    title: 'Act II sag — tension drops below 4 for 5 consecutive scenes',
    body: 'Between S14 and S18 the tension stays at 3-4. Consider cutting one quiet scene or adding a subplot beat to maintain momentum.',
    refs: ['S14', 'S15', 'S16', 'S17', 'S18'],
  },
  {
    severity: 'amber',
    category: 'Character',
    title: 'Fen disappears for 12 scenes',
    body: 'Fen last appears in S7 and does not return until S19. This is the longest character gap in the manuscript. Consider a brief mention or interstitial.',
    refs: ['S7', 'S19'],
  },
  {
    severity: 'amber',
    category: 'Structure',
    title: 'Midpoint arrives late — scene 22 of 47',
    body: 'The structural midpoint (the first fire) occurs at 47% rather than the conventional 50%. This is within tolerance but worth noting.',
    refs: ['S22'],
  },
  {
    severity: 'blue',
    category: 'Symbol',
    title: 'Orchard motif carries well across all three acts',
    body: 'The orchard appears in 14 scenes across all acts, serving as the primary symbolic throughline. Strong thematic cohesion.',
    refs: ['S1', 'S8', 'S13', 'S22', 'S47'],
  },
];
