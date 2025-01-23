import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/ui/components/button'
import { useAuth } from '@/lib/auth/AuthContext'
import { TeamService } from '@/services/teams'
import { supabase } from '@/services/supabase'
import type { Team, TeamMember, TeamSchedule } from '@/modules/teams/types/team.types'
import { NewTeamDialog } from '@/modules/admin/components/teams/NewTeamDialog'
import { EditTeamDialog } from '@/modules/admin/components/teams/EditTeamDialog'
import { TeamSkillsDialog } from '@/modules/admin/components/teams/TeamSkillsDialog'
import { TeamScheduleDialog } from '@/modules/admin/components/teams/TeamScheduleDialog'
import { TeamMembersDialog } from '@/modules/admin/components/teams/TeamMembersDialog'
import type { UserSkill, Skill } from '@/modules/teams/types/team.types'

/**
 * TeamManagementPage component
 * Displays a list of teams with options to manage members, skills, and schedules
 */
export function TeamManagementPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [teams, setTeams] = useState<Team[]>([])
  const [teamMembers, setTeamMembers] = useState<Record<string, (TeamMember & { user: any })[]>>({})
  const [teamSchedules, setTeamSchedules] = useState<Record<string, (TeamSchedule & { user: any })[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [managingSkills, setManagingSkills] = useState<Team | null>(null)
  const [managingSchedule, setManagingSchedule] = useState<Team | null>(null)
  const [managingMembers, setManagingMembers] = useState<Team | null>(null)
  const [userSkills, setUserSkills] = useState<Record<string, (UserSkill & { skill: Skill })[]>>({})

  // Verify admin access
  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!user) {
        navigate('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        navigate('/dashboard')
      }
    }
    checkAdminAccess()
  }, [navigate, user])

  const fetchData = async () => {
    if (!user) return // Don't fetch if not authenticated

    try {
      const teamsData = await TeamService.getTeams()
      setTeams(teamsData)

      // Fetch members for each team
      const membersPromises = teamsData.map(team => 
        TeamService.getTeamMembers(team.id)
          .then(members => [team.id, members])
      )
      
      const membersResults = await Promise.all(membersPromises)
      const membersMap = Object.fromEntries(membersResults)
      setTeamMembers(membersMap)

      // Fetch user skills for each team
      const userSkillsPromises = teamsData.map(async team => {
        const skills = await TeamService.getTeamMemberSkills(team.id)
        return [team.id, skills]
      })
      
      const userSkillsResults = await Promise.all(userSkillsPromises)
      const userSkillsMap = Object.fromEntries(userSkillsResults)
      setUserSkills(userSkillsMap)

      // Fetch schedules for each team
      const schedulesPromises = teamsData.map(async team => {
        const schedules = await TeamService.getTeamSchedules(team.id)
        return [team.id, schedules]
      })
      
      const schedulesResults = await Promise.all(schedulesPromises)
      const schedulesMap = Object.fromEntries(schedulesResults)
      setTeamSchedules(schedulesMap)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load teams')
    } finally {
      setLoading(false)
    }
  }

  // Fetch teams and members
  useEffect(() => {
    if (user) { // Only fetch if user is authenticated
      fetchData()
    }
  }, [user]) // Add user as dependency

  const handleTeamCreated = (newTeam: Team) => {
    setTeams(prev => [...prev, newTeam])
    setTeamMembers(prev => ({ ...prev, [newTeam.id]: [] }))
  }

  const handleTeamUpdated = (updatedTeam: Team) => {
    setTeams(prev => prev.map(team => 
      team.id === updatedTeam.id ? updatedTeam : team
    ))
  }

  const handleTeamDeleted = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team?')) {
      return
    }

    try {
      await TeamService.deleteTeam(teamId)
      setTeams(prev => prev.filter(team => team.id !== teamId))
    } catch (err) {
      console.error('Error deleting team:', err)
      setError('Failed to delete team')
    }
  }

  // Helper functions for formatting
  const getDayName = (day: number) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    return days[day - 1] // Subtract 1 since array is 0-based but ISO weekdays are 1-based
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes}${ampm}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Team Management</h1>
          <p className="text-muted-foreground">Manage teams, skills, and schedules</p>
        </div>
        <NewTeamDialog onTeamCreated={handleTeamCreated} />
      </div>

      {error && (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {teams.map(team => (
          <div
            key={team.id}
            className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{team.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {team.description || 'No description'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManagingMembers(team)}
                >
                  Members
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManagingSchedule(team)}
                >
                  Schedules
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManagingSkills(team)}
                >
                  Skills
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingTeam(team)}
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleTeamDeleted(team.id)}
                >
                  Delete
                </Button>
              </div>
            </div>

            {/* Team Members */}
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Team Members</h4>
              <div className="space-y-4">
                {teamMembers[team.id]?.map(member => (
                  <div
                    key={member.id}
                    className="p-4 rounded-md border bg-muted/30"
                  >
                    {/* Member Info */}
                    <div className="grid grid-cols-3 gap-8">
                      <div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{member.user.full_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {member.user.email}
                            </p>
                          </div>
                          {member.is_team_lead && (
                            <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                              Team Lead
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Skills Section */}
                      <div>
                        <h5 className="text-sm font-medium mb-2">Skills</h5>
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            const skills = userSkills[team.id] || [];
                            const memberSkills = skills.filter(s => s.user_id === member.user_id);

                            if (memberSkills.length === 0) {
                              return <div className="text-sm text-muted-foreground">No skills</div>;
                            }

                            return (
                              <div className="space-y-1">
                                {memberSkills.map(s => (
                                  <div key={s.id} className="bg-secondary/10 p-2 rounded text-sm">
                                    {s.skill.name} - Level {s.proficiency_level}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Schedule Section */}
                      <div>
                        <h5 className="text-sm font-medium mb-2">Schedule</h5>
                        <div className="space-y-1">
                          {(() => {
                            const schedules = teamSchedules[team.id]?.filter(
                              s => s.user_id === member.user_id
                            )?.sort((a, b) => a.day_of_week - b.day_of_week);

                            if (!schedules?.length) {
                              return <div className="text-sm text-muted-foreground">No schedule set</div>;
                            }

                            return schedules.map(schedule => (
                              <div key={schedule.id} className="bg-secondary/10 p-2 rounded text-sm">
                                {getDayName(schedule.day_of_week)} • {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Team Dialog */}
      {editingTeam && (
        <EditTeamDialog
          team={editingTeam}
          open={true}
          onOpenChange={(isOpen: boolean) => {
            if (!isOpen) setEditingTeam(null)
          }}
          onTeamUpdated={(updatedTeam) => {
            handleTeamUpdated(updatedTeam)
            setEditingTeam(null)
          }}
        />
      )}

      {/* Team Skills Dialog */}
      {managingSkills && (
        <TeamSkillsDialog
          team={managingSkills}
          open={true}
          onOpenChange={(isOpen: boolean) => {
            if (!isOpen) setManagingSkills(null)
          }}
          onSkillsUpdated={() => {
            setManagingSkills(null)
            fetchData()
          }}
        />
      )}

      {/* Team Schedule Dialog */}
      {managingSchedule && (
        <TeamScheduleDialog
          team={managingSchedule}
          members={teamMembers[managingSchedule.id] || []}
          open={true}
          onOpenChange={(isOpen: boolean) => {
            if (!isOpen) setManagingSchedule(null)
          }}
          onSchedulesUpdated={fetchData}
        />
      )}

      {/* Team Members Dialog */}
      {managingMembers && (
        <TeamMembersDialog
          team={managingMembers}
          open={true}
          onOpenChange={(isOpen: boolean) => {
            if (!isOpen) setManagingMembers(null)
          }}
          onMembersUpdated={() => {
            fetchData()
          }}
        />
      )}
    </div>
  )
} 