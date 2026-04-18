import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TweaksPanel } from '../components/TweaksPanel'

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <TweaksPanel />
    </>
  ),
})
