import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { authApi } from '@/lib/api'

interface AuthContextType {
  isAuthenticated: boolean
  username: string | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await authApi.checkAuth()
      if (response.success && response.data?.logged_in) {
        setIsAuthenticated(true)
        setUsername(response.data.username || null)
      } else {
        setIsAuthenticated(false)
        setUsername(null)
      }
    } catch {
      setIsAuthenticated(false)
      setUsername(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (username: string, password: string) => {
    const response = await authApi.login(username, password)
    if (response.success) {
      setIsAuthenticated(true)
      setUsername(username)
      return { success: true }
    }
    return { success: false, error: response.error || '登录失败' }
  }

  const logout = async () => {
    await authApi.logout()
    setIsAuthenticated(false)
    setUsername(null)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
