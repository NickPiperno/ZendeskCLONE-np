/**
 * AuthContext.tsx
 * Provides authentication context and hooks for the application.
 * Manages user session, admin status, and auth state changes.
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { AuthService } from '@/services/auth'
import { supabase } from '@/services/supabase'
import type { Session, User as SupabaseUser, AuthError } from '@supabase/supabase-js'
import type { UserProfile } from '@/modules/auth/types/user.types'

/**
 * Shape of the authentication context
 */
interface AuthContextType {
  /** Current session object */
  session: Session | null
  /** Current Supabase user object */
  user: SupabaseUser | null
  /** Current user profile with application-specific data */
  profile: UserProfile | null
  /** Loading state for auth operations */
  loading: boolean
  /** Whether the current user is an admin */
  isAdmin: boolean
  /** Function to sign in a user */
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  /** Function to sign up a new user */
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null }>
  /** Function to sign out the current user */
  signOut: () => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Provider component for authentication context
 * @param props - Component props
 * @returns React component
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authError, setAuthError] = useState<AuthError | null>(null)

  // Fetch user profile when user changes
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfile(null)
        setIsAdmin(false)
        setLoading(false)
        return
      }

      const { profile, error } = await AuthService.getCurrentProfile()
      if (error) {
        console.error('Error fetching profile:', error)
        setLoading(false)
        return
      }

      setProfile(profile)
      setIsAdmin(profile?.is_active && profile?.role === 'admin' || false)
      setLoading(false)
    }

    fetchProfile()
  }, [user])

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { session, error } = await AuthService.getSession()
        if (error) throw error
        
        setSession(session)
        setUser(session?.user ?? null)
      } catch (error) {
        console.error('Error initializing auth:', error)
        setAuthError(error as AuthError)
        setLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event)
      setSession(session)
      setUser(session?.user ?? null)

      // Don't set loading to false here - it will be set after profile fetch
    })

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const value = {
    session,
    user,
    profile,
    loading,
    isAdmin,
    signIn: AuthService.signIn,
    signUp: AuthService.signUp,
    signOut: AuthService.signOut
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="p-4 rounded-md bg-destructive/10 text-destructive">
          Authentication Error: {authError.message}
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to access authentication context
 * @returns Authentication context
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 