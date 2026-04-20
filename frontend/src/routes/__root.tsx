import { createRootRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useStore } from '../store'
import { useEffect } from 'react'

function RootComponent() {
  const accessToken = useStore(s => s.accessToken)
  const navigate = useNavigate()

  useEffect(() => {
    const publicRoutes = ['/login', '/signup', '/forgot-password', '/welcome']
    const currentPath = window.location.pathname

    if (!accessToken && !publicRoutes.includes(currentPath)) {
      navigate({ to: '/login' })
    } else if (accessToken && publicRoutes.includes(currentPath)) {
      navigate({ to: '/dashboard' })
    }
  }, [accessToken, navigate])

  return <Outlet />
}

export const Route = createRootRoute({
  component: RootComponent,
})
