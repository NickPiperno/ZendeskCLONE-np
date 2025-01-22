/**
 * auth.ts
 * Service for handling user authentication and authorization.
 * Provides methods for user signup, signin, signout, and admin status checks.
 */

import { supabase } from './supabase'
import type { AuthError, Session, AuthResponse } from '@supabase/supabase-js'
import type { UserProfile } from '@/modules/auth/types/user.types'

/**
 * Service for handling authentication
 */
export class AuthService {
  /**
   * Sign up a new user
   * @param email - User's email address
   * @param password - User's password
   * @param fullName - User's display name
   * @returns Promise resolving to AuthResponse
   */
  static async signUp(email: string, password: string, fullName: string): Promise<AuthResponse> {
    try {
      const response = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      })

      if (response.error) throw response.error
      return response
    } catch (error) {
      console.error('Failed to sign up:', error)
      return { data: { user: null, session: null }, error: error as AuthError }
    }
  }

  /**
   * Sign in a user
   * @param email - User's email address
   * @param password - User's password
   * @returns Promise resolving to AuthResponse
   */
  static async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (response.error) throw response.error
      return response
    } catch (error) {
      console.error('Failed to sign in:', error)
      return { data: { user: null, session: null }, error: error as AuthError }
    }
  }

  /**
   * Sign out the current user
   * @returns Promise resolving to AuthResponse
   */
  static async signOut(): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      return { error: null }
    } catch (error) {
      console.error('Failed to sign out:', error)
      return { error: error as AuthError }
    }
  }

  /**
   * Get the current session
   * @returns Promise resolving to session data
   */
  static async getSession(): Promise<{ session: Session | null, error: AuthError | null }> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error
      return { session, error: null }
    } catch (error) {
      console.error('Failed to get session:', error)
      return { session: null, error: error as AuthError }
    }
  }

  /**
   * Get the current user's profile
   * @returns Promise resolving to UserProfile or null
   */
  static async getCurrentProfile(): Promise<{ profile: UserProfile | null, error: Error | null }> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) return { profile: null, error: null }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError
      return { profile: profile as UserProfile, error: null }
    } catch (error) {
      console.error('Failed to get current profile:', error)
      return { profile: null, error: error as Error }
    }
  }

  /**
   * Check if the current user is an admin
   * @returns Promise resolving to boolean indicating admin status
   */
  static async isAdmin(): Promise<boolean> {
    try {
      const { profile } = await this.getCurrentProfile()
      return profile?.is_active && profile?.role === 'admin' || false
    } catch (error) {
      console.error('Failed to check admin status:', error)
      return false
    }
  }
} 