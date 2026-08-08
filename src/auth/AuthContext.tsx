import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Static-password gate (demo mode).
 *
 * There is NO Firebase Authentication here: the app is opened with one shared
 * password, checked in the browser. This is a convenience lock for a client
 * test, NOT real security — the password ships in the bundle and the database
 * is open, so anyone determined can bypass it. For real use, put Firebase Auth
 * back (see git history) and lock the Firestore rules to the owner's account.
 */
const PASSWORD = (import.meta.env.VITE_APP_PASSWORD as string | undefined)?.trim() || 'lib123123'
const KEY = 'lib.gate.v1'

interface AuthContextValue {
  /** Truthy once the correct password has been entered on this device. */
  user: boolean
  loading: boolean
  login: (password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Remembered on the device so the owner logs in once, not every visit.
  const [user, setUser] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) === 'ok'
    } catch {
      return false
    }
  })

  const login = async (password: string) => {
    if (password.trim() !== PASSWORD) {
      // Shaped like a Firebase error so LoginPage's existing check still works.
      const err = new Error('wrong password') as Error & { code?: string }
      err.code = 'auth/wrong-password'
      throw err
    }
    try {
      localStorage.setItem(KEY, 'ok')
    } catch {
      /* private mode / storage disabled — session-only login still works */
    }
    setUser(true)
  }

  const logout = async () => {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
    setUser(false)
  }

  return (
    <AuthContext.Provider value={{ user, loading: false, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
