import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAdminAuth } from '../lib/adminAuthContext'
import Splash from './Splash'

// Wraps every back-office page except the sign-in: no session, no page.
export default function RequireAdmin() {
  const { status } = useAdminAuth()
  const { pathname, search } = useLocation()
  if (status === 'loading') return <Splash />
  if (status === 'anon') return <Navigate to="/admin/login" replace state={{ from: pathname + search }} />
  return <Outlet />
}
