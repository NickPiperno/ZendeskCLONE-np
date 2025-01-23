export type SkillCategory = 'technical' | 'product' | 'language' | 'soft_skill'

export interface Team {
  id: string
  created_at: string
  updated_at: string
  name: string
  description: string | null
  is_active: boolean
  deleted: boolean
  deleted_at: string | null
}

export interface TeamInsert {
  id?: string
  created_at?: string
  updated_at?: string
  name: string
  description?: string | null
  is_active?: boolean
  deleted?: boolean
  deleted_at?: string | null
}

export interface TeamUpdate {
  id?: string
  created_at?: string
  updated_at?: string
  name?: string
  description?: string | null
  is_active?: boolean
  deleted?: boolean
  deleted_at?: string | null
}

export interface Skill {
  id: string
  created_at: string
  updated_at: string
  name: string
  description: string | null
  category: SkillCategory
  is_active: boolean
}

export interface SkillInsert {
  id?: string
  created_at?: string
  updated_at?: string
  name: string
  description?: string | null
  category: SkillCategory
  is_active?: boolean
}

export interface SkillUpdate {
  id?: string
  created_at?: string
  updated_at?: string
  name?: string
  description?: string | null
  category?: SkillCategory
  is_active?: boolean
}

export interface TeamMember {
  id: string
  created_at: string
  updated_at: string
  team_id: string
  user_id: string
  is_team_lead: boolean
}

export interface TeamMemberInsert {
  id?: string
  created_at?: string
  updated_at?: string
  team_id: string
  user_id: string
  is_team_lead?: boolean
}

export interface TeamMemberUpdate {
  id?: string
  created_at?: string
  updated_at?: string
  team_id?: string
  user_id?: string
  is_team_lead?: boolean
}

export interface UserSkill {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  skill_id: string
  proficiency_level: number
}

export interface UserSkillInsert {
  id?: string
  created_at?: string
  updated_at?: string
  user_id: string
  skill_id: string
  proficiency_level: number
}

export interface UserSkillUpdate {
  id?: string
  created_at?: string
  updated_at?: string
  user_id?: string
  skill_id?: string
  proficiency_level?: number
}

export interface TeamSchedule {
  id: string
  created_at: string
  updated_at: string
  team_id: string
  user_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
}

export interface TeamScheduleInsert {
  id?: string
  created_at?: string
  updated_at?: string
  team_id: string
  user_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active?: boolean
}

export interface TeamScheduleUpdate {
  id?: string
  created_at?: string
  updated_at?: string
  team_id?: string
  user_id?: string
  day_of_week?: number
  start_time?: string
  end_time?: string
  is_active?: boolean
} 