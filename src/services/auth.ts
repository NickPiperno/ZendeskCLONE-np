import { supabase } from './supabase'
import type { UserRole } from '@/modules/auth/types/user.types'

/**
 * Service for handling authentication
 */
export class AuthService {
  /**
   * Sign up a new user
   */
  static async signUp(email: string, password: string, role: UserRole = 'user', fullName?: string) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
            full_name: fullName
          }
        }
      })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Failed to sign up:', error)
      return { data: null, error }
    }
  }

  /**
   * Sign in a user
   */
  static async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Failed to sign in:', error)
      return { data: null, error }
    }
  }

  /**
   * Sign out the current user
   */
  static async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      return { error: null }
    } catch (error) {
      console.error('Failed to sign out:', error)
      return { error }
    }
  }

  /**
   * Get the current session
   */
  static async getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error
      return { session, error: null }
    } catch (error) {
      console.error('Failed to get session:', error)
      return { session: null, error }
    }
  }

  /**
   * Get the current user's role
   */
  static async getCurrentUserRole(): Promise<UserRole | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      // First try to get the profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile doesn't exist, create it
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              full_name: user.email?.split('@')[0] || 'New User',
              role: 'user'
            })
            .select('role')
            .single()

          if (createError) throw createError
          return newProfile?.role || null
        }
        throw error
      }

      return profile?.role || null
    } catch (error) {
      console.error('Failed to get user role:', error)
      return null
    }
  }

  /**
   * Update a user's role (admin only)
   */
  static async updateUserRole(userId: string, newRole: UserRole) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error
      return { error: null }
    } catch (error) {
      console.error('Failed to update user role:', error)
      return { error }
    }
  }
} 