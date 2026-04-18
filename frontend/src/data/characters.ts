import type { Character } from '../types';

export const sampleCharacters: Character[] = [
  { name: 'Iris', role: 'Protagonist', desire: 'Save the orchard and preserve her family legacy', flaw: 'Cannot let go of the past', sceneCount: 40, longestGap: 0 },
  { name: 'Wren', role: 'Foil', desire: 'Redemption for abandoning the family', flaw: 'Avoids confrontation until it is too late', sceneCount: 24, longestGap: 3 },
  { name: 'Cole', role: 'Antagonist', desire: 'Control the land and its future', flaw: 'Believes ownership equals power', sceneCount: 22, longestGap: 5 },
  { name: 'Jon', role: 'Mirror', desire: 'Understand his own place in the valley', flaw: 'Watches instead of acting', sceneCount: 18, longestGap: 4 },
  { name: 'Mara', role: 'Family', desire: 'Protect Iris from the truth', flaw: 'Keeps secrets that corrode trust', sceneCount: 12, longestGap: 9 },
  { name: 'Kai', role: 'Mentor', desire: 'Guide Iris without imposing his will', flaw: 'Carries guilt from a past failure', sceneCount: 9, longestGap: 8 },
  { name: 'Fen', role: 'Ward', desire: 'Escape the valley and start fresh', flaw: 'Lies reflexively when cornered', sceneCount: 8, longestGap: 12 },
  { name: 'Doc', role: 'Witness', desire: 'Record the truth before it vanishes', flaw: 'Trusts paper more than people', sceneCount: 6, longestGap: 15 },
  { name: 'Sib', role: 'Pawn', desire: 'Please whoever holds power', flaw: 'Cannot distinguish loyalty from submission', sceneCount: 6, longestGap: 11 },
  { name: 'Old Man', role: 'Ghost', desire: 'Be remembered as he was, not as he became', flaw: 'Left no instructions for the living', sceneCount: 4, longestGap: 18 },
];
