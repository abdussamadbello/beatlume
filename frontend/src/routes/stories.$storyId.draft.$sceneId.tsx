import { useEffect } from 'react'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useStore } from '../store'

export const Route = createFileRoute('/stories/$storyId/draft/$sceneId')({
  component: DraftScenePage,
})

function DraftScenePage() {
  const { storyId, sceneId } = Route.useParams()
  const setActiveSceneN = useStore((s) => s.setActiveSceneN)

  useEffect(() => {
    const n = parseInt(sceneId, 10)
    if (!isNaN(n)) {
      setActiveSceneN(n)
    }
  }, [sceneId, setActiveSceneN])

  return <Navigate to="/stories/$storyId/draft" params={{ storyId }} />
}
