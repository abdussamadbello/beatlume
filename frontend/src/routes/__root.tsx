import { createRootRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useStore } from '../store'
import { useEffect } from 'react'

function RootComponent() {
  const isLoggedIn = useStore(s => s.isLoggedIn)
  const navigate = useNavigate()

  useEffect(() => {
    const publicRoutes = ['/login', '/signup', '/forgot-password']
    const currentPath = window.location.pathname

    if (!isLoggedIn && !publicRoutes.includes(currentPath)) {
      navigate({ to: '/login' })
    } else if (isLoggedIn && publicRoutes.includes(currentPath)) {
      navigate({ to: '/dashboard' })
    }
  }, [isLoggedIn, navigate])

  return <Outlet />
}

export const Route = createRootRoute({
  component: RootComponent,
})
