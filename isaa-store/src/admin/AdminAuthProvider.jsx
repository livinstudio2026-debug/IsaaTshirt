import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminAuthContext } from '../lib/adminAuthContext'
import { adminLogin, adminLogout, adminMe, setUnauthorizedHandler } from '../lib/adminApi'

const ANON = { status: 'anon', admin: null, bootError: null }

export default function AdminAuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', admin: null, bootError: null })
  const [notice, setNotice] = useState(null)

  // Who am I? (the cookie, if any, answers)
  useEffect(() => {
    const ac = new AbortController()
    adminMe(ac.signal).then(
      (admin) => setState({ status: 'authed', admin, bootError: null }),
      (err) => { if (err.name !== 'AbortError') setState({ ...ANON, bootError: err.network ? err.message : null }) },
    )
    return () => ac.abort()
  }, [])

  // Any later admin request that comes back 401 means the session ended (expired, signed out elsewhere, account disabled).
  useEffect(() => {
    setUnauthorizedHandler(() => { setState(ANON); setNotice('expired') })
    return () => setUnauthorizedHandler(null)
  }, [])

  const login = useCallback(async (credentials) => {
    const admin = await adminLogin(credentials)
    // Make sure the browser really kept the cookie, so a blocked cookie shows a clear message instead of a silent bounce back to the form.
    try { await adminMe() } catch (err) {
      if (err.status === 401) throw Object.assign(new Error('Your browser didn’t keep the sign-in. Allow cookies for this site (and turn off private mode), then try again.'), { cookie: true })
      throw err
    }
    setNotice(null)
    setState({ status: 'authed', admin, bootError: null })
  }, [])

  const logout = useCallback(async () => {
    try { await adminLogout() } catch { /* offline: the screen still locks; the server session ends on its own at expiry */ }
    setNotice('signedout')
    setState(ANON)
  }, [])

  const value = useMemo(() => ({ ...state, notice, login, logout }), [state, notice, login, logout])
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}
