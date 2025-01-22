/**
 * LoginPage.tsx
 * Handles user authentication through a login/signup form.
 * Supports both login and signup modes with admin-only access control.
 */

import { useState } from 'react'
import { Button } from '@/ui/components/button'
import { useAuth } from '@/lib/auth/AuthContext'
import { useNavigate } from 'react-router-dom'

interface LoginPageProps {
  /** Initial mode of the page - either 'login' or 'signup' */
  mode?: 'login' | 'signup'
}

/**
 * LoginPage component that handles user authentication
 * @param props - Component props
 * @returns React component
 */
export function LoginPage({ mode = 'login' }: LoginPageProps) {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentMode, setCurrentMode] = useState<'login' | 'signup'>(mode)
  const [showVerification, setShowVerification] = useState(false)

  /**
   * Handles form submission for both login and signup
   * @param e - Form submission event
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (currentMode === 'login') {
        const { error } = await signIn(email, password)
        if (error) throw error
        navigate('/dashboard')
      } else {
        // Signup requires full name
        if (!fullName.trim()) {
          throw new Error('Display name is required')
        }
        const { error } = await signUp(email, password, fullName)
        if (error) throw error
        setShowVerification(true)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (showVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-8 p-8 border rounded-lg shadow-sm">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Check your email</h1>
            <p className="mt-2 text-muted-foreground">
              We've sent a verification link to <span className="font-medium">{email}</span>
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Please check your email and click the verification link to complete your registration.
              After verifying, you can sign in to your account.
            </p>
          </div>
          <Button
            onClick={() => {
              setShowVerification(false)
              setCurrentMode('login')
              navigate('/login')
            }}
            className="w-full"
            variant="outline"
          >
            Back to Sign In
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 p-8 border rounded-lg shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            {currentMode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {currentMode === 'login'
              ? "Don't have an account? "
              : 'Already have an account? '}
            <button
              onClick={() => setCurrentMode(currentMode === 'login' ? 'signup' : 'login')}
              className="font-medium text-primary hover:underline"
              type="button"
              aria-label={currentMode === 'login' ? 'Switch to signup' : 'Switch to login'}
            >
              {currentMode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>

        {error && (
          <div className="p-3 text-sm rounded-md bg-destructive/10 text-destructive" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {currentMode === 'signup' && (
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium">
                Display Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required={currentMode === 'signup'}
                className="mt-1 block w-full px-3 py-2 border rounded-md"
                placeholder="Your name"
                aria-label="Display name"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              placeholder="you@example.com"
              aria-label="Email address"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              placeholder="••••••••"
              aria-label="Password"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? 'Please wait...'
              : currentMode === 'login'
              ? 'Sign in'
              : 'Sign up'}
          </Button>
        </form>
      </div>
    </div>
  )
} 