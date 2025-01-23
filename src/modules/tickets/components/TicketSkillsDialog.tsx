import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/ui/components/dialog"
import { Button } from "@/ui/components/button"
import { Select } from "@/ui/components/select"
import type { Skill } from '@/modules/teams/types/team.types'
import { TicketService } from '@/services/tickets'
import { TeamService } from '@/services/teams'

interface TicketSkill {
  id: string
  ticket_id: string
  skill_id: string
  required_proficiency: number
}

interface TicketSkillsDialogProps {
  ticketId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSkillsUpdated?: () => void
}

/**
 * Dialog for managing ticket required skills
 */
export function TicketSkillsDialog({ ticketId, open, onOpenChange, onSkillsUpdated }: TicketSkillsDialogProps) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [ticketSkills, setTicketSkills] = useState<TicketSkill[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [selectedSkill, setSelectedSkill] = useState<string>('')
  const [requiredProficiency, setRequiredProficiency] = useState<number>(1)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  const loadData = async () => {
    setLoading(true)
    setError(null)

    try {
      const [allSkills, currentSkills] = await Promise.all([
        TeamService.getSkills(),
        TicketService.getTicketSkills(ticketId)
      ])

      if ('code' in currentSkills) {
        throw new Error(currentSkills.message)
      }

      setSkills(allSkills)
      setTicketSkills(currentSkills as TicketSkill[])
    } catch (err) {
      console.error('Error loading skills data:', err)
      setError('Failed to load skills data')
    } finally {
      setLoading(false)
    }
  }

  const handleAddSkill = async () => {
    if (!selectedSkill) return

    setSubmitting(true)
    setError(null)

    try {
      const result = await TicketService.addTicketSkills(ticketId, [{
        skillId: selectedSkill,
        requiredProficiency
      }])

      if ('code' in result) {
        throw new Error(result.message)
      }

      await loadData()
      onSkillsUpdated?.()

      // Reset form
      setSelectedSkill('')
      setRequiredProficiency(1)
    } catch (err) {
      console.error('Error adding skill:', err)
      setError('Failed to add skill')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveSkill = async (skillId: string) => {
    setSubmitting(true)
    setError(null)

    try {
      const { error } = await TicketService.removeTicketSkill(skillId)
      if (error) throw new Error(error)

      await loadData()
      onSkillsUpdated?.()
    } catch (err) {
      console.error('Error removing skill:', err)
      setError('Failed to remove skill')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Required Skills</DialogTitle>
          <DialogDescription>
            Manage required skills and proficiency levels for this ticket.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {error && (
          <div className="p-3 text-sm rounded-md bg-destructive/10 text-destructive">
            {error}
          </div>
        )}

        {/* Add Skill Form */}
        <div className="space-y-4 p-4 rounded-md border bg-muted/30">
          <h3 className="text-sm font-medium">Add Required Skill</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Skill
              </label>
              <Select
                value={selectedSkill}
                onValueChange={setSelectedSkill}
              >
                <option value="">Select skill...</option>
                <optgroup label="Technical Skills">
                  {skills.filter(s => s.category === 'technical').map(skill => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Product Skills">
                  {skills.filter(s => s.category === 'product').map(skill => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Language Skills">
                  {skills.filter(s => s.category === 'language').map(skill => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Soft Skills">
                  {skills.filter(s => s.category === 'soft_skill').map(skill => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Required Proficiency (1-5)
              </label>
              <Select
                value={requiredProficiency.toString()}
                onValueChange={(value) => setRequiredProficiency(parseInt(value, 10))}
              >
                {[1, 2, 3, 4, 5].map(level => (
                  <option key={level} value={level.toString()}>
                    {level}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Button
            onClick={handleAddSkill}
            disabled={!selectedSkill || submitting}
          >
            {submitting ? 'Adding...' : 'Add Skill'}
          </Button>
        </div>

        {/* Skills List */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Current Required Skills</h3>
          <div className="grid grid-cols-2 gap-4">
            {ticketSkills.map(skill => (
              <div
                key={skill.id}
                className="p-3 rounded-md border bg-card"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">
                      {skills.find(s => s.id === skill.skill_id)?.name}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSkill(skill.id)}
                      disabled={submitting}
                    >
                      Remove
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Required Proficiency: {skill.required_proficiency}
                  </p>
                </div>
              </div>
            ))}
            {ticketSkills.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-2">No skills required</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 