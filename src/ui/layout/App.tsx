import { useAuth } from '@/lib/auth/AuthContext'
import { LoginPage } from '@/modules/auth/pages/LoginPage'
import { MainLayout } from './MainLayout'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { WelcomePage } from '@/modules/home/pages/WelcomePage'
import { DashboardPage } from '@/modules/dashboard/pages/DashboardPage'
import { AdminTicketsPage } from '@/modules/tickets/pages/AdminTicketsPage'
import { CustomerTicketsPage } from '@/modules/tickets/pages/CustomerTicketsPage'
import { SettingsPage } from '@/modules/settings/pages/SettingsPage'
import { AgentDashboardPage } from '@/modules/tickets/pages/AgentDashboardPage'
import { AdminConsolePage } from '@/modules/admin/pages/AdminConsolePage'
import { TeamManagementPage } from '@/modules/admin/pages/TeamManagementPage'
import { UserManagementPage } from '@/modules/admin/pages/UserManagementPage'
import { AdminMetricsPage } from '@/modules/admin/pages/AdminMetricsPage'
import { AdminSettingsPage } from '@/modules/admin/pages/AdminSettingsPage'
import { AuditLogsPage } from '@/modules/admin/pages/AuditLogsPage'
import { TestDbPage } from '@/modules/admin/pages/TestDbPage'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { KnowledgeBasePage } from '@/modules/knowledge-base/pages/KnowledgeBasePage'

const queryClient = new QueryClient()

export default function App() {
  const { user, loading, profile } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
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
              <Route 
                path="/" 
                element={
                  profile?.role === 'user' 
                    ? <Navigate to="/tickets/my-tickets" replace /> 
                    : <DashboardPage />
                } 
              />
              <Route 
                path="/dashboard" 
                element={
                  profile?.role === 'user' 
                    ? <Navigate to="/tickets/my-tickets" replace /> 
                    : <DashboardPage />
                } 
              />
              <Route 
                path="/tickets" 
                element={
                  profile?.role === 'user' 
                    ? <Navigate to="/tickets/my-tickets" replace /> 
                    : <AdminTicketsPage />
                } 
              />
              <Route path="/tickets/my-tickets" element={<CustomerTicketsPage />} />
              <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
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
    </QueryClientProvider>
  )
} 