import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/ui/components/dialog"
import { Button } from "@/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/ui/components/select"
import { Label } from "@/ui/components/label"
import { Checkbox } from "@/ui/components/checkbox"
import { TeamService } from '@/services/teams'
import { supabase } from '@/services/supabase'
import type { Team, TeamMember } from '@/modules/teams/types/team.types'

interface TeamMembersDialogProps {
  team: Team
  open: boolean
  onOpenChange: (open: boolean) => void
  onMembersUpdated: () => void
}

export function TeamMembersDialog({ team, open, onOpenChange, onMembersUpdated }: TeamMembersDialogProps) {
  const [availableUsers, setAvailableUsers] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<(TeamMember & { user: any })[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [isTeamLead, setIsTeamLead] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open, team.id])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get all active agents and admins
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .in('role', ['agent', 'admin'])

      if (usersError) throw usersError

      // Get current team members
      const members = await TeamService.getTeamMembers(team.id)

      // Filter out users who are already team members
      const memberUserIds = members.map(m => m.user_id)
      const availableUsers = users.filter(user => !memberUserIds.includes(user.id))

      setAvailableUsers(availableUsers)
      setTeamMembers(members)
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleAddMember = async () => {
    if (!selectedUserId) return

    try {
      setSubmitting(true)
      setError(null)

      await TeamService.addTeamMember({
        team_id: team.id,
        user_id: selectedUserId,
        is_team_lead: isTeamLead
      })

      await loadData()
      onMembersUpdated()

      // Reset form
      setSelectedUserId('')
      setIsTeamLead(false)
    } catch (err) {
      console.error('Error adding team member:', err)
      setError('Failed to add team member')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    try {
      setError(null)
      await TeamService.removeTeamMember(team.id, userId)
      await loadData()
      onMembersUpdated()
    } catch (err) {
      console.error('Error removing team member:', err)
      setError('Failed to remove team member')
    }
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Team Members</DialogTitle>
            <DialogDescription>
              Manage team members and assign team leads.
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Team Members</DialogTitle>
          <DialogDescription>
            Manage team members and assign team leads.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 text-sm rounded-md bg-destructive/10 text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Add Member Form */}
          <div className="space-y-4 p-4 rounded-md border bg-muted/30">
            <h3 className="text-sm font-medium">Add Member</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>User</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name} ({user.email}) - {user.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="isTeamLead"
                  checked={isTeamLead}
                  onCheckedChange={(checked) => setIsTeamLead(checked === true)}
                />
                <Label htmlFor="isTeamLead" className="text-sm">
                  Assign as Team Lead
                </Label>
              </div>
            </div>

            <Button
              onClick={handleAddMember}
              disabled={!selectedUserId || submitting}
            >
              {submitting ? 'Adding...' : 'Add Member'}
            </Button>
          </div>

          {/* Current Members List */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Current Members</h3>
            <div className="grid gap-4">
              {teamMembers.map(member => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-md border bg-card"
                >
                  <div>
                    <p className="font-medium">{member.user.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {member.user.email} - {member.user.role}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {member.is_team_lead && (
                      <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                        Team Lead
                      </span>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveMember(member.user_id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 