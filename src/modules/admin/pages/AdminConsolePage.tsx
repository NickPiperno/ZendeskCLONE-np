import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/services/supabase'

/**
 * AdminConsolePage.tsx
 * Main admin interface for managing teams, users, and system settings.
 */
export function AdminConsolePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Verify user is an admin
  useEffect(() => {
    const checkRole = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single()

      if (!profile || profile.role !== 'admin') {
        navigate('/dashboard')
      }
    }

    checkRole()
  }, [user, navigate])

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Console</h1>
        <p className="text-muted-foreground">Manage teams, users, and system settings</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Team Management */}
        <Link
          to="/admin/teams"
          className="p-6 border rounded-lg bg-card hover:bg-card/80 transition-colors"
        >
          <h2 className="text-xl font-semibold mb-2">Team Management</h2>
          <p className="text-muted-foreground">
            Manage teams, members, skills, and schedules
          </p>
        </Link>

        {/* User Management */}
        <Link
          to="/admin/users"
          className="p-6 border rounded-lg bg-card hover:bg-card/80 transition-colors"
        >
          <h2 className="text-xl font-semibold mb-2">User Management</h2>
          <p className="text-muted-foreground">
            Manage user accounts, roles, and permissions
          </p>
        </Link>

        {/* Knowledge Base Management */}
        <Link
          to="/admin/knowledge-base"
          className="p-6 border rounded-lg bg-card hover:bg-card/80 transition-colors"
        >
          <h2 className="text-xl font-semibold mb-2">Knowledge Base</h2>
          <p className="text-muted-foreground">
            Manage articles, drafts, and categories
          </p>
        </Link>

        {/* System Metrics */}
        <Link
          to="/admin/metrics"
          className="p-6 border rounded-lg bg-card hover:bg-card/80 transition-colors"
        >
          <h2 className="text-xl font-semibold mb-2">System Performance</h2>
          <p className="text-muted-foreground">
            Monitor system metrics and data usage
          </p>
        </Link>

        {/* Audit Logs */}
        <Link
          to="/admin/audit-logs"
          className="p-6 border rounded-lg bg-card hover:bg-card/80 transition-colors"
        >
          <h2 className="text-xl font-semibold mb-2">Audit Logs</h2>
          <p className="text-muted-foreground">
            Track and review system activity and changes
          </p>
        </Link>

        {/* Settings */}
        <Link
          to="/admin/settings"
          className="p-6 border rounded-lg bg-card hover:bg-card/80 transition-colors"
        >
          <h2 className="text-xl font-semibold mb-2">Settings</h2>
          <p className="text-muted-foreground">
            Configure system settings and preferences
          </p>
        </Link>
      </div>
    </div>
  )
} 