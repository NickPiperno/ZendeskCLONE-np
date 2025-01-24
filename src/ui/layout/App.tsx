import { useAuth } from '@/lib/auth/AuthContext'
import { LoginPage } from '@/modules/auth/pages/LoginPage'
import { MainLayout } from './MainLayout'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { WelcomePage } from '@/modules/home/pages/WelcomePage'
import { DashboardPage } from '@/modules/dashboard/pages/DashboardPage'
import { TicketsPage } from '@/modules/tickets/pages/TicketsPage'
import { SettingsPage } from '@/modules/settings/pages/SettingsPage'
import { AgentDashboardPage } from '@/modules/tickets/pages/AgentDashboardPage'
import { AdminConsolePage } from '@/modules/admin/pages/AdminConsolePage'
import { TeamManagementPage } from '@/modules/admin/pages/TeamManagementPage'
import { UserManagementPage } from '@/modules/admin/pages/UserManagementPage'
import { AdminMetricsPage } from '@/modules/admin/pages/AdminMetricsPage'
import { AdminSettingsPage } from '@/modules/admin/pages/AdminSettingsPage'
import { AuditLogsPage } from '@/modules/admin/pages/AuditLogsPage'
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
            <Route path="/admin" element={<AdminConsolePage />} />
            <Route path="/admin/teams" element={<TeamManagementPage />} />
            <Route path="/admin/users" element={<UserManagementPage />} />
            <Route path="/admin/metrics" element={<AdminMetricsPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
            <Route path="/admin/test-db" element={<TestDbPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </MainLayout>
      )}
    </BrowserRouter>
  )
} 