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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/ui/components/select"
import type { Skill } from '@/modules/teams/types/team.types'
import { TicketService } from '@/services/tickets'
import { TeamService } from '@/services/teams'
import { Label } from '@/ui/components/label'

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
  const [proficiency, setProficiency] = useState<number>(1)

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

    setLoading(true)
    setError(null)

    const result = await TicketService.addTicketSkills(ticketId, [{
      skillId: selectedSkill,
      requiredProficiency: proficiency
    }])

    if (Array.isArray(result)) {
      setTicketSkills(prev => [...prev, ...result])
      setSelectedSkill('')
      setProficiency(1)
      onSkillsUpdated?.()
    } else {
      setError(result.message)
    }

    setLoading(false)
  }

  const handleRemoveSkill = async (skillId: string) => {
    setLoading(true)
    setError(null)

    const { error } = await TicketService.removeTicketSkill(skillId)

    if (error) {
      setError(error)
    } else {
      setTicketSkills(prev => prev.filter(s => s.id !== skillId))
      onSkillsUpdated?.()
    }

    setLoading(false)
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
          <div className="grid grid-cols-[1fr,auto,auto] gap-2 items-end">
            <div className="space-y-2">
              <Label>Skill</Label>
              <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a skill..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {/* Technical Skills */}
                  <SelectGroup>
                    <SelectItem value="_group_technical" disabled className="font-semibold !text-foreground !bg-muted py-2 px-3 -mx-1 my-1 rounded-sm hover:!bg-muted">
                      Technical Skills
                    </SelectItem>
                    {skills
                      .filter(s => s.category === 'technical')
                      .filter(skill => !ticketSkills.some(ts => ts.skill_id === skill.id))
                      .map(skill => (
                        <SelectItem key={skill.id} value={skill.id}>
                          {skill.name}
                        </SelectItem>
                      ))
                    }
                  </SelectGroup>
                  {/* Product Skills */}
                  <SelectGroup>
                    <SelectItem value="_group_product" disabled className="font-semibold !text-foreground !bg-muted py-2 px-3 -mx-1 my-1 rounded-sm hover:!bg-muted">
                      Product Skills
                    </SelectItem>
                    {skills
                      .filter(s => s.category === 'product')
                      .filter(skill => !ticketSkills.some(ts => ts.skill_id === skill.id))
                      .map(skill => (
                        <SelectItem key={skill.id} value={skill.id}>
                          {skill.name}
                        </SelectItem>
                      ))
                    }
                  </SelectGroup>
                  {/* Language Skills */}
                  <SelectGroup>
                    <SelectItem value="_group_language" disabled className="font-semibold !text-foreground !bg-muted py-2 px-3 -mx-1 my-1 rounded-sm hover:!bg-muted">
                      Language Skills
                    </SelectItem>
                    {skills
                      .filter(s => s.category === 'language')
                      .filter(skill => !ticketSkills.some(ts => ts.skill_id === skill.id))
                      .map(skill => (
                        <SelectItem key={skill.id} value={skill.id}>
                          {skill.name}
                        </SelectItem>
                      ))
                    }
                  </SelectGroup>
                  {/* Soft Skills */}
                  <SelectGroup>
                    <SelectItem value="_group_soft_skill" disabled className="font-semibold !text-foreground !bg-muted py-2 px-3 -mx-1 my-1 rounded-sm hover:!bg-muted">
                      Soft Skills
                    </SelectItem>
                    {skills
                      .filter(s => s.category === 'soft_skill')
                      .filter(skill => !ticketSkills.some(ts => ts.skill_id === skill.id))
                      .map(skill => (
                        <SelectItem key={skill.id} value={skill.id}>
                          {skill.name}
                        </SelectItem>
                      ))
                    }
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Required Proficiency</Label>
              <Select 
                value={proficiency.toString()} 
                onValueChange={(value) => setProficiency(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select level..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {[1, 2, 3, 4, 5].map(level => (
                      <SelectItem key={level} value={level.toString()}>
                        Level {level}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleAddSkill}
              disabled={!selectedSkill || loading}
            >
              {loading ? 'Adding...' : 'Add Skill'}
            </Button>
          </div>
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
                      disabled={loading}
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