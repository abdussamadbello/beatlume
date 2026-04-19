import type { MockStory } from '../types'

export const mockStories: MockStory[] = [
  { id: 'orchard', title: 'A Stranger in the Orchard', genre: 'Literary / Mystery', wordCount: 72340, sceneCount: 47, draftNumber: 3, lastEdited: 'Today', status: 'in-progress', tensionPreview: [3,4,5,6,7,8,6,5,7,9,10,8,5,3] },
  { id: 'lighthouse', title: "The Lighthouse Keeper's Daughter", genre: 'Gothic / Romance', wordCount: 45200, sceneCount: 28, draftNumber: 1, lastEdited: '3 days ago', status: 'in-progress', tensionPreview: [2,3,5,4,6,7,5,8,6,4,7,9,6,4] },
  { id: 'signal', title: 'Signal Loss', genre: 'Sci-Fi / Thriller', wordCount: 89100, sceneCount: 62, draftNumber: 2, lastEdited: '1 week ago', status: 'in-progress', tensionPreview: [4,5,6,7,5,8,9,7,6,8,9,10,7,5] },
  { id: 'parish', title: 'Parish of Small Mercies', genre: 'Literary Fiction', wordCount: 34000, sceneCount: 19, draftNumber: 1, lastEdited: '2 weeks ago', status: 'in-progress', tensionPreview: [3,4,3,5,6,4,5,7,6,5,4,6,8,5] },
  { id: 'untitled', title: 'Untitled Project', genre: '', wordCount: 0, sceneCount: 0, draftNumber: 0, lastEdited: 'Yesterday', status: 'not-started', tensionPreview: [] },
  { id: 'cartographer', title: "The Cartographer's Error", genre: 'Historical / Adventure', wordCount: 58400, sceneCount: 41, draftNumber: 4, lastEdited: '1 month ago', status: 'completed', tensionPreview: [3,5,4,6,7,5,8,7,6,9,8,10,7,4] },
]
