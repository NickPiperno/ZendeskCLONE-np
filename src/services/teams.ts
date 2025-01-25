import { supabase } from './supabase'
import type {
  Team,
  TeamInsert,
  TeamUpdate,
  TeamMember,
  TeamMemberInsert,
  TeamSchedule,
  TeamScheduleInsert,
  Skill,
  SkillInsert,
  UserSkill,
  UserSkillInsert
} from '@/modules/teams/types/team.types'

/**
 * Service for managing teams and related entities
 */
export const TeamService = {
  // Team operations
  async getTeams() {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('name')
      .eq('deleted', false)

    if (error) {
      console.error('Error fetching teams:', error)
      throw error
    }

    if (!data) {
      return []
    }

    return data as Team[]
  },

  async getTeam(id: string) {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching team:', error)
      throw error
    }

    return data as Team
  },

  async createTeam(team: TeamInsert) {
    const { data, error } = await supabase
      .from('teams')
      .insert(team)
      .select()
      .single()

    if (error) throw error
    return data as Team
  },

  async updateTeam(id: string, updates: TeamUpdate) {
    const { data, error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as Team
  },

  async deleteTeam(id: string) {
    const { error } = await supabase
      .rpc('soft_delete_team', { team_id: id })

    if (error) throw error
  },

  // Team member operations
  async getTeamMembers(teamId: string) {
    // First, get team members
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)

    if (membersError) {
      console.error('Error fetching team members:', membersError)
      throw membersError
    }

    if (!members?.length) return []

    // Then, get user profiles for those members
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', members.map(m => m.user_id))

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      throw profilesError
    }

    // Combine the data
    const membersWithProfiles = members.map(member => {
      const profile = profiles?.find(p => p.id === member.user_id)
      return {
        ...member,
        user: {
          id: member.user_id,
          email: profile?.email,
          full_name: profile?.full_name,
          role: profile?.role
        }
      }
    })

    return membersWithProfiles as (TeamMember & { user: any })[]
  },

  async getTeamMemberSkills(teamId: string) {
    // First, get team members
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)

    if (membersError) throw membersError
    if (!members?.length) return []

    // Then, get user skills for those members
    const { data: userSkills, error: skillsError } = await supabase
      .from('user_skills')
      .select('*')
      .in('user_id', members.map(m => m.user_id))

    if (skillsError) throw skillsError
    if (!userSkills?.length) return []

    // Finally, get the skills details
    const { data: skills, error: skillDetailsError } = await supabase
      .from('skills')
      .select('*')
      .in('id', userSkills.map(us => us.skill_id))

    if (skillDetailsError) throw skillDetailsError
    if (!skills?.length) return []

    // Combine the data
    return userSkills.map(us => ({
      ...us,
      skill: skills.find(s => s.id === us.skill_id)
    })) as (UserSkill & { skill: Skill })[]
  },

  async addTeamMember(member: TeamMemberInsert) {
    const { data, error } = await supabase
      .from('team_members')
      .insert(member)
      .select()
      .single()

    if (error) throw error
    return data as TeamMember
  },

  async removeTeamMember(teamId: string, userId: string) {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId)

    if (error) throw error
  },

  // Team schedule operations
  async getTeamSchedules(teamId: string) {
    // First get the schedules
    const { data: schedules, error: schedulesError } = await supabase
      .from('team_schedules')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .eq('deleted', false)  // Only get non-deleted schedules

    if (schedulesError) throw schedulesError
    if (!schedules?.length) return []

    // Then get the user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', schedules.map(s => s.user_id))

    if (profilesError) throw profilesError

    // Combine the data
    return schedules.map(schedule => ({
      ...schedule,
      user: profiles?.find(p => p.id === schedule.user_id)
    })) as (TeamSchedule & { user: any })[]
  },

  async addTeamSchedule(schedule: TeamScheduleInsert) {
    const { data, error } = await supabase
      .from('team_schedules')
      .insert({
        ...schedule,
        deleted: false
      })
      .select()
      .single()

    if (error) throw error
    return data as TeamSchedule
  },

  async updateTeamSchedule(id: string, updates: Partial<TeamSchedule>) {
    const { data, error } = await supabase
      .from('team_schedules')
      .update(updates)
      .eq('id', id)
      .eq('deleted', false)  // Only update non-deleted schedules
      .select()
      .single()

    if (error) throw error
    return data as TeamSchedule
  },

  async removeTeamSchedule(id: string) {
    const { error } = await supabase
      .rpc('soft_delete_team_schedule', { schedule_id: id })

    if (error) throw error
  },

  // Skills operations
  async getSkills() {
    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) throw error
    return data as Skill[]
  },

  async createSkill(skill: SkillInsert) {
    const { data, error } = await supabase
      .from('skills')
      .insert(skill)
      .select()
      .single()

    if (error) throw error
    return data as Skill
  },

  // User skills operations
  async getUserSkills(userId: string) {
    const { data, error } = await supabase
      .from('user_skills')
      .select(`
        *,
        skill:skill_id (*)
      `)
      .eq('user_id', userId)

    if (error) throw error
    return data as (UserSkill & { skill: Skill })[]
  },

  async addUserSkill(userSkill: UserSkillInsert) {
    const { data, error } = await supabase
      .from('user_skills')
      .insert(userSkill)
      .select()
      .single()

    if (error) throw error
    return data as UserSkill
  },

  async updateUserSkill(id: string, updates: Partial<UserSkill>) {
    const { data, error } = await supabase
      .from('user_skills')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as UserSkill
  },

  async removeUserSkill(id: string) {
    const { error } = await supabase
      .from('user_skills')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
} 