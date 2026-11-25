import { createContext, useContext } from 'react'

// { status: 'loading' | 'authed' | 'anon', admin, notice: null | 'expired' | 'signedout', bootError, login, logout }
export const AdminAuthContext = createContext(null)

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used inside <AdminAuthProvider>')
  return ctx
}
