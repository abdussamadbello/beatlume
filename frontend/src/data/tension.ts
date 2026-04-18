import type { Act, Peak } from '../types';

export const tensionData: number[] = [
  3, 4, 3, 5, 4, 6, 5, 4, 5, 6,
  7, 5, 4, 6, 7, 8, 6, 5, 7, 8,
  9, 7, 5, 4, 6, 8, 9, 8, 7, 6,
  5, 4, 6, 7, 8, 9, 10, 8, 5, 3,
];

export const sampleActs: Act[] = [
  { at: 0, label: 'Act I' },
  { at: 13, label: 'Act II' },
  { at: 30, label: 'Act III' },
];

export const samplePeaks: Peak[] = [
  { at: 20, v: 9, label: 'Midpoint' },
  { at: 36, v: 10, label: 'Climax' },
];
