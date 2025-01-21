import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/ui/components/button'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/services/supabase'
import { AuthService } from '@/services/auth'
import type { UserRole } from '@/modules/auth/types/user.types'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
  is_active: boolean
}

interface DbProfile {
  id: string
  full_name: string | null
  role: UserRole
  created_at: string
  is_active: boolean
  auth_users: {
    email: string
  }
}

export function UserManagementPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  // Verify admin access
  useEffect(() => {
    const checkAdminAccess = async () => {
      const role = await AuthService.getCurrentUserRole()
      if (role !== 'admin') {
        navigate('/dashboard')
      }
    }
    checkAdminAccess()
  }, [navigate])

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            role,
            created_at,
            is_active,
            auth_users:auth.users(email)
          `)
          .order('created_at', { ascending: false })

        if (error) throw error

        if (data) {
          const profiles = data as unknown as DbProfile[]
          setUsers(profiles.map(profile => ({
            id: profile.id,
            email: profile.auth_users.email,
            full_name: profile.full_name,
            role: profile.role,
            created_at: profile.created_at,
            is_active: profile.is_active
          })))
        }
      } catch (err) {
        console.error('Error fetching users:', err)
        setError('Failed to load users')
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [])

  const handleRoleUpdate = async (userId: string, newRole: UserRole) => {
    if (userId === user?.id) {
      setError("You cannot change your own role")
      return
    }

    setUpdatingUserId(userId)
    setError(null)

    try {
      const { error } = await AuthService.updateUserRole(userId, newRole)
      if (error) throw error

      setUsers(users.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ))
    } catch (err) {
      console.error('Error updating role:', err)
      setError('Failed to update user role')
    } finally {
      setUpdatingUserId(null)
    }
  }

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
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground">Manage user roles and permissions</p>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-md border">
        <div className="p-4 bg-muted/50">
          <div className="grid grid-cols-12 gap-4 text-sm font-medium">
            <div className="col-span-3">Name</div>
            <div className="col-span-3">Email</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Actions</div>
          </div>
        </div>

        <div className="divide-y">
          {users.map(user => (
            <div key={user.id} className="p-4">
              <div className="grid grid-cols-12 gap-4 items-center">
                <div className="col-span-3">
                  {user.full_name || 'No name'}
                </div>
                <div className="col-span-3 text-sm text-muted-foreground">
                  {user.email}
                </div>
                <div className="col-span-2">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleUpdate(user.id, e.target.value as UserRole)}
                    disabled={updatingUserId === user.id}
                    className="w-full px-2 py-1 rounded-md border bg-background"
                  >
                    <option value="user">User</option>
                    <option value="agent">Agent</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                    user.is_active
                      ? 'bg-success/10 text-success'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="col-span-2">
                  {updatingUserId === user.id ? (
                    <span className="text-sm text-muted-foreground">
                      Updating...
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRoleUpdate(user.id, user.role)}
                      disabled={true}
                    >
                      Save
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 