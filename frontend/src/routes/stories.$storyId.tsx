import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router'
import { AppShell, AIProgressBanner, Sidebar } from '../components/chrome'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import { AIPanel, AILauncher } from '../components/ai/AIPanel'
import { useStory } from '../api/stories'
import { useSSE } from '../hooks/useSSE'

export const Route = createFileRoute('/stories/$storyId')({
  component: StoryLayout,
})

function StoryLayout() {
  const { storyId } = Route.useParams()
  const location = useLocation()
  const { data: story, isLoading, error, refetch } = useStory(storyId)
  useSSE(storyId)

  let body
  if (isLoading) {
    body = <LoadingState />
  } else if (error || !story) {
    body = <ErrorState error={error as Error} onRetry={refetch} />
  } else {
    body = <Outlet />
  }

  return (
    <AppShell sidebar={<Sidebar storyId={storyId} active={location.pathname} story={story} />}>
      <AIProgressBanner />
      {body}
      <AILauncher />
      <AIPanel storyId={storyId} />
    </AppShell>
  )
}
