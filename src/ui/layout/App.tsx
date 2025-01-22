import { useAuth } from '@/lib/auth/AuthContext'
import { LoginPage } from '@/modules/auth/pages/LoginPage'
import { MainLayout } from './MainLayout'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { WelcomePage } from '@/modules/home/pages/WelcomePage'
import { DashboardPage } from '@/modules/dashboard/pages/DashboardPage'
import { TicketsPage } from '@/modules/tickets/pages/TicketsPage'
import { SettingsPage } from '@/modules/settings/pages/SettingsPage'
import { AgentDashboardPage } from '@/modules/tickets/pages/AgentDashboardPage'
import { UserManagementPage } from '@/modules/admin/pages/UserManagementPage'
import { TestDbPage } from '@/modules/admin/pages/TestDbPage'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      {!user ? (
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/login" element={<LoginPage mode="login" />} />
          <Route path="/signup" element={<LoginPage mode="signup" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <MainLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/agent" element={<AgentDashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin/users" element={<UserManagementPage />} />
            <Route path="/admin/test-db" element={<TestDbPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </MainLayout>
      )}
    </BrowserRouter>
  )
} 