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
import { TeamService } from '@/services/teams'
import type { Team, TeamMember, Skill, UserSkill } from '@/modules/teams/types/team.types'
import { Label } from '@/ui/components/label'

interface TeamSkillsDialogProps {
  team: Team
  onSkillsUpdated: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Dialog for managing team member skills
 */
export function TeamSkillsDialog({ team, onSkillsUpdated, open, onOpenChange }: TeamSkillsDialogProps) {
  const [members, setMembers] = useState<(TeamMember & { user: { full_name: string, email: string } })[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [userSkills, setUserSkills] = useState<(UserSkill & { skill: Skill })[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [selectedMember, setSelectedMember] = useState<string>('')
  const [selectedSkill, setSelectedSkill] = useState<string>('')
  const [proficiencyLevel, setProficiencyLevel] = useState<number>(1)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      loadTeamData()
    }
  }, [open])

  const loadTeamData = async () => {
    setLoading(true)
    setError(null)

    try {
      const [teamMembers, allSkills, memberSkills] = await Promise.all([
        TeamService.getTeamMembers(team.id),
        TeamService.getSkills(),
        TeamService.getTeamMemberSkills(team.id)
      ])

      setMembers(teamMembers)
      setSkills(allSkills)
      setUserSkills(memberSkills)
    } catch (err) {
      console.error('Error loading team data:', err)
      setError('Failed to load team data')
    } finally {
      setLoading(false)
    }
  }

  const handleAddSkill = async () => {
    if (!selectedMember || !selectedSkill) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await TeamService.addUserSkill({
        user_id: selectedMember,
        skill_id: selectedSkill,
        proficiency_level: proficiencyLevel
      })

      // Refetch skills to get skill details
      const updatedSkills = await TeamService.getTeamMemberSkills(team.id)
      setUserSkills(updatedSkills)

      // Notify parent component
      onSkillsUpdated?.()

      // Reset form
      setSelectedMember('')
      setSelectedSkill('')
      setProficiencyLevel(1)
    } catch (err) {
      console.error('Error adding skill:', err)
      setError('Failed to add skill')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveSkill = async (userSkillId: string) => {
    setLoading(true)
    setError(null)

    try {
      await TeamService.removeUserSkill(userSkillId)
      await loadTeamData()
      onSkillsUpdated()
    } catch (err) {
      console.error('Error removing skill:', err)
      setError('Failed to remove skill')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Team Skills</DialogTitle>
          <DialogDescription>
            Manage team member skills and proficiency levels.
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
          <h3 className="text-sm font-medium">Add Skill</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Team Member</Label>
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger>
                  <SelectValue placeholder="Select member..." />
                </SelectTrigger>
                <SelectContent>
                  {members.map(member => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Skill</Label>
              <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                <SelectTrigger>
                  <SelectValue placeholder="Select skill..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {/* Technical Skills */}
                  <SelectGroup>
                    <SelectItem value="_group_technical" disabled className="font-semibold !text-foreground !bg-muted py-2 px-3 -mx-1 my-1 rounded-sm hover:!bg-muted">
                      Technical Skills
                    </SelectItem>
                    {skills.filter(s => s.category === 'technical').map(skill => (
                      <SelectItem key={skill.id} value={skill.id}>
                        {skill.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  {/* Product Skills */}
                  <SelectGroup>
                    <SelectItem value="_group_product" disabled className="font-semibold !text-foreground !bg-muted py-2 px-3 -mx-1 my-1 rounded-sm hover:!bg-muted">
                      Product Skills
                    </SelectItem>
                    {skills.filter(s => s.category === 'product').map(skill => (
                      <SelectItem key={skill.id} value={skill.id}>
                        {skill.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  {/* Language Skills */}
                  <SelectGroup>
                    <SelectItem value="_group_language" disabled className="font-semibold !text-foreground !bg-muted py-2 px-3 -mx-1 my-1 rounded-sm hover:!bg-muted">
                      Language Skills
                    </SelectItem>
                    {skills.filter(s => s.category === 'language').map(skill => (
                      <SelectItem key={skill.id} value={skill.id}>
                        {skill.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  {/* Soft Skills */}
                  <SelectGroup>
                    <SelectItem value="_group_soft_skill" disabled className="font-semibold !text-foreground !bg-muted py-2 px-3 -mx-1 my-1 rounded-sm hover:!bg-muted">
                      Soft Skills
                    </SelectItem>
                    {skills.filter(s => s.category === 'soft_skill').map(skill => (
                      <SelectItem key={skill.id} value={skill.id}>
                        {skill.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Proficiency Level (1-5)</Label>
            <Select value={proficiencyLevel.toString()} onValueChange={(value) => setProficiencyLevel(parseInt(value, 10))}>
              <SelectTrigger>
                <SelectValue placeholder="Select level..." />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map(level => (
                  <SelectItem key={level} value={level.toString()}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleAddSkill}
            disabled={!selectedMember || !selectedSkill || !proficiencyLevel || submitting}
          >
            {submitting ? 'Adding...' : 'Add Skill'}
          </Button>
        </div>

        {/* Skills List */}
        {selectedMember && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Current Skills</h3>
            <div className="grid grid-cols-2 gap-4">
              {userSkills
                .filter(s => s.user_id === selectedMember)
                .map(userSkill => (
                  <div
                    key={userSkill.id}
                    className="p-3 rounded-md border bg-card"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">
                          {userSkill.skill.name}
                        </p>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveSkill(userSkill.id)}
                        >
                          Remove
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Proficiency Level: {userSkill.proficiency_level}
                      </p>
                    </div>
                  </div>
                ))}
              {userSkills.filter(s => s.user_id === selectedMember).length === 0 && (
                <p className="text-sm text-muted-foreground col-span-2">No skills assigned</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
} 