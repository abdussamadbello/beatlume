import type { Scene } from '../types';

export const sampleScenes: Scene[] = [
  { n: 1, title: 'Orchard at dawn', pov: 'Iris', tension: 3, act: 1, location: 'Orchard', tag: 'Setup' },
  { n: 2, title: 'The letter from Col.', pov: 'Iris', tension: 5, act: 1, location: 'Kitchen', tag: 'Inciting' },
  { n: 3, title: 'Wren returns uninvited', pov: 'Iris', tension: 6, act: 1, location: 'Porch', tag: 'Conflict' },
  { n: 4, title: 'Mara dismisses the rumor', pov: 'Iris', tension: 4, act: 1, location: 'Barn', tag: 'Quiet' },
  { n: 5, title: 'Jon watches from the ridge', pov: 'Jon', tension: 5, act: 2, location: 'Ridge', tag: 'Shift' },
  { n: 6, title: "Kai's warning", pov: 'Iris', tension: 7, act: 2, location: 'Cellar', tag: 'Escalation' },
  { n: 7, title: 'Fen lies to Doc', pov: 'Fen', tension: 6, act: 2, location: 'Clinic', tag: 'Deception' },
  { n: 8, title: 'Night — the first fire', pov: 'Iris', tension: 9, act: 2, location: 'Orchard', tag: 'Turn' },
];

export const allScenes: Scene[] = [
  ...sampleScenes,
  { n: 9, title: 'Morning ashes', pov: 'Iris', tension: 6, act: 2, location: 'Orchard', tag: 'Aftermath' },
  { n: 10, title: 'Cole at the court', pov: 'Cole', tension: 5, act: 2, location: 'Court', tag: 'Subplot' },
  { n: 11, title: 'Root cellar', pov: 'Iris', tension: 8, act: 2, location: 'Cellar', tag: 'Escalation' },
  { n: 12, title: 'Confession', pov: 'Iris', tension: 10, act: 3, location: 'Kitchen', tag: 'Climax' },
  { n: 13, title: 'The orchard emptied', pov: 'Iris', tension: 5, act: 3, location: 'Orchard', tag: 'Resolution' },
];
