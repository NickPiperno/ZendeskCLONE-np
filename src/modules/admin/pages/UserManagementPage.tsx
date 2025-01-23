import { useState, useEffect } from 'react'
import { Button } from '@/ui/components/button'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/services/supabase'
import type { UserRole } from '@/modules/auth/types/user.types'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
  is_active: boolean
}

export function UserManagementPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error

        if (data) {
          setUsers(data as UserProfile[])
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
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
      
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

  const handleStatusUpdate = async (userId: string, newStatus: boolean) => {
    if (userId === user?.id) {
      setError("You cannot change your own status")
      return
    }

    setUpdatingUserId(userId)
    setError(null)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: newStatus })
        .eq('id', userId)
      
      if (error) throw error

      setUsers(users.map(u => 
        u.id === userId ? { ...u, is_active: newStatus } : u
      ))
    } catch (err) {
      console.error('Error updating status:', err)
      setError('Failed to update user status')
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
    <div className="space-y-6">
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
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="col-span-2">
                  <Button
                    variant={user.is_active ? "outline" : "secondary"}
                    size="sm"
                    onClick={() => handleStatusUpdate(user.id, !user.is_active)}
                    disabled={updatingUserId === user.id}
                    className="w-full"
                  >
                    {user.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
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