import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { MainLayout } from '@/components/layout/MainLayout'
import LoginPage from '@/pages/LoginPage'
import ArtistsPage from '@/pages/ArtistsPage'
import CategoriesPage from '@/pages/CategoriesPage'
import PresetsPage from '@/pages/PresetsPage'
import ToolsPage from '@/pages/ToolsPage'
import SettingsPage from '@/pages/SettingsPage'

// 受保护的路由组件
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <MainLayout>{children}</MainLayout>
}

// 登录页路由（已登录则重定向到首页）
function LoginRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <LoginPage />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ArtistsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/artists"
        element={
          <ProtectedRoute>
            <ArtistsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/categories"
        element={
          <ProtectedRoute>
            <CategoriesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/presets"
        element={
          <ProtectedRoute>
            <PresetsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tools"
        element={
          <ProtectedRoute>
            <ToolsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
