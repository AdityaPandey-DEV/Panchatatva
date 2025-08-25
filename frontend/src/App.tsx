import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { useAuthStore } from '@/store/authStore'
import { useEffect } from 'react'
import HomePage from '@/pages/HomePage'
import AuthPage from '@/pages/AuthPage'
import DashboardPage from '@/pages/DashboardPage'
import CasePage from '@/pages/CasePage'
import CaseUploadPage from '@/pages/CaseUploadPage'
import ProfilePage from '@/pages/ProfilePage'
import AdminPage from '@/pages/AdminPage'
import Layout from '@/components/Layout'
import LoadingSpinner from '@/components/ui/loading-spinner'

function App() {
  const { user, loading, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/auth" element={<AuthPage />} />
        
        {/* Protected routes */}
        {user ? (
          <>
            <Route path="/dashboard" element={
              <Layout>
                <DashboardPage />
              </Layout>
            } />
            <Route path="/cases/:id" element={
              <Layout>
                <CasePage />
              </Layout>
            } />
            <Route path="/cases/upload" element={
              <Layout>
                <CaseUploadPage />
              </Layout>
            } />
            <Route path="/profile" element={
              <Layout>
                <ProfilePage />
              </Layout>
            } />
            {user.role === 'admin' && (
              <Route path="/admin" element={
                <Layout>
                  <AdminPage />
                </Layout>
              } />
            )}
          </>
        ) : (
          <>
            <Route path="/dashboard" element={<Navigate to="/auth" replace />} />
            <Route path="/cases/*" element={<Navigate to="/auth" replace />} />
            <Route path="/profile" element={<Navigate to="/auth" replace />} />
            <Route path="/admin" element={<Navigate to="/auth" replace />} />
          </>
        )}
      </Routes>
      <Toaster />
    </>
  )
}

export default App
