import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router'
import { AppShell, Sidebar } from '../components/chrome'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
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

  if (isLoading) {
    return (
      <AppShell sidebar={<Sidebar storyId={storyId} active={location.pathname} title="Loading..." />}>
        <LoadingState />
      </AppShell>
    )
  }
  if (error || !story) {
    return (
      <AppShell sidebar={<Sidebar storyId={storyId} active={location.pathname} title="Error" />}>
        <ErrorState error={error as Error} onRetry={refetch} />
      </AppShell>
    )
  }

  return (
    <AppShell sidebar={<Sidebar storyId={storyId} active={location.pathname} title={story.title} />}>
      <Outlet />
    </AppShell>
  )
}
