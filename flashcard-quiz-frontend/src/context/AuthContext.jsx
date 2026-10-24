import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { clearSession, loadSession, loginUser, setUnauthorizedHandler } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // Restore the logged-in user if the tab was just refreshed.
  const [user, setUser] = useState(() => loadSession()?.user ?? null)
  const [notice, setNotice] = useState('')

  const login = useCallback(async (credentials) => {
    const loggedIn = await loginUser(credentials)
    setNotice('')
    setUser(loggedIn)
    return loggedIn
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  // If the backend ever answers 401 to an authenticated call, sign out.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession()
      setUser(null)
      setNotice('Your session expired. Please log in again.')
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  const value = useMemo(
    () => ({ user, login, logout, notice, clearNotice: () => setNotice('') }),
    [user, login, logout, notice],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Where each role should land after login. */
export function homePathFor(user) {
  return user?.role === 'ADMIN' ? '/admin' : '/dashboard'
}
