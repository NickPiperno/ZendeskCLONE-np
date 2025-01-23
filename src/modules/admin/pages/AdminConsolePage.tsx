import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/ui/components/button'
import { AuthService } from '@/services/auth'
import { TeamManagementPage } from './TeamManagementPage'
import { UserManagementPage } from './UserManagementPage'

type Tab = 'teams' | 'users'

/**
 * AdminConsolePage component
 * Unified admin interface with tabs for team and user management
 */
export function AdminConsolePage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('teams')
  const [loading, setLoading] = useState(true)

  // Verify admin access
  useEffect(() => {
    const checkAdminAccess = async () => {
      const { profile } = await AuthService.getCurrentProfile()
      if (!profile?.is_active || profile?.role !== 'admin') {
        navigate('/dashboard')
      }
      setLoading(false)
    }
    checkAdminAccess()
  }, [navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Console</h1>
        <p className="text-muted-foreground">Manage teams, users, and system settings</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 border-b">
        <Button
          variant={activeTab === 'teams' ? 'default' : 'ghost'}
          className="rounded-none border-b-2 border-transparent px-4 py-2 -mb-[2px]"
          onClick={() => setActiveTab('teams')}
        >
          Teams
        </Button>
        <Button
          variant={activeTab === 'users' ? 'default' : 'ghost'}
          className="rounded-none border-b-2 border-transparent px-4 py-2 -mb-[2px]"
          onClick={() => setActiveTab('users')}
        >
          Users
        </Button>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'teams' ? (
          <TeamManagementPage />
        ) : (
          <UserManagementPage />
        )}
      </div>
    </div>
  )
} 