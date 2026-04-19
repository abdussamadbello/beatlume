import type { Scene } from '../types';
import { manuscriptChapters } from './chapters';

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

export const sceneProse: Record<number, string> = {
  1: manuscriptChapters[0].paras.join('\n\n'),
  2: manuscriptChapters[1].paras.join('\n\n'),
  3: manuscriptChapters[2].paras.join('\n\n'),
  4: manuscriptChapters[3].paras.join('\n\n'),
  5: manuscriptChapters[4].paras.join('\n\n'),
  6: "Kai met her at the cellar door with a lantern already lit. The steps were damp, the air smelled of kerosene and cold stone. He told her what he had found buried beneath the oldest shelf — a letter in handwriting she recognized.",
  7: "Fen sat across from Doc and lied with the ease of a man who had practiced on himself first. The clinic was too bright, the questions too careful. He answered every one and meant none of them.",
  8: "The fire came from the north field at an hour when no one should have been awake to see it. Iris ran toward the smoke with nothing but a shovel and a half-formed prayer. By the time Jon arrived, two rows of apple trees were already gone.",
  9: "Morning revealed what the dark had tried to hide. Ash covered the north field in a thin, even layer, as if the fire had been careful. Iris walked the rows counting what remained and trying not to count what did not.",
  10: "Cole arrived at the county court in a suit that still smelled of the city. He carried a folder thick with documents and a confidence that came from having read every one of them. The clerk looked up and recognized trouble.",
  11: "The root cellar was colder than Iris remembered, or perhaps she had simply forgotten how cold truth could feel. The box Kai had found was small, wooden, and sealed with wax that crumbled at her touch. Inside were three photographs and a deed she had never seen.",
  12: "Iris set the deed on the kitchen table between them and waited. Cole looked at it the way a man looks at a door he thought he had locked. The silence lasted long enough for the kettle to boil, and then he told her everything.",
  13: "The orchard stood empty in the late afternoon light, its remaining trees casting long shadows across the cleared ground. Iris walked the boundary one last time, touching each fence post as she passed. Some things, she decided, were better held loosely.",
};
