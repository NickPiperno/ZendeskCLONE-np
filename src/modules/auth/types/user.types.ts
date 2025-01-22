import type { User as SupabaseUser } from '@supabase/supabase-js'

export type UserRole = 'admin' | 'agent' | 'user'

/**
 * Represents a user's profile in our application
 * Extended from Supabase's base user type with additional application-specific fields
 */
export interface UserProfile {
  id: string // Maps to Supabase User.id
  created_at: string
  email: string // Maps to Supabase User.email
  full_name: string
  role: UserRole
  is_active: boolean
}

export interface UserProfileInsert {
  id?: string
  created_at?: string
  email: string
  full_name: string
  role?: UserRole
  is_active?: boolean
}

export interface UserProfileUpdate {
  id?: string
  created_at?: string
  email?: string
  full_name?: string
  role?: UserRole
  is_active?: boolean
}

/**
 * Helper function to convert a Supabase User to our UserProfile type
 */
export function mapSupabaseUser(user: SupabaseUser, role: UserRole = 'user'): Partial<UserProfile> {
  return {
    id: user.id,
    email: user.email || '',
    created_at: user.created_at,
    role
  }
} 