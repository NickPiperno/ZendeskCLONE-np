import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/ui/components/dialog"
import { Button } from "@/ui/components/button"
import { Input } from "@/ui/components/input"
import { Textarea } from "@/ui/components/textarea"
import { TeamService } from '@/services/teams'
import type { Team } from '@/modules/teams/types/team.types'

interface EditTeamDialogProps {
  team: Team
  onTeamUpdated: (team: Team) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Dialog for editing an existing team
 */
export function EditTeamDialog({ team, onTeamUpdated, open, onOpenChange }: EditTeamDialogProps) {
  const [name, setName] = useState(team.name)
  const [description, setDescription] = useState(team.description || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(team.name)
      setDescription(team.description || '')
      setError(null)
    }
  }, [open, team])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!name.trim()) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const updatedTeam = await TeamService.updateTeam(team.id, {
        name: name.trim(),
        description: description.trim() || null
      })
      
      onTeamUpdated(updatedTeam)
      onOpenChange(false)
    } catch (err) {
      console.error('Error updating team:', err)
      setError('Failed to update team')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Team</DialogTitle>
          <DialogDescription>
            Update team details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm rounded-md bg-destructive/10 text-destructive">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Team Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="Enter team name"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="description"
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder="Describe the team's purpose..."
              className="min-h-[100px]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 