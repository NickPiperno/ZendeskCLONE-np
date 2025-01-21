import { useState } from 'react'
import { Button } from '@/ui/components/button'
import { useAuth } from '@/lib/auth/AuthContext'

interface LoginPageProps {
  mode?: 'login' | 'signup'
}

export function LoginPage({ mode = 'login' }: LoginPageProps) {
  const { signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentMode, setCurrentMode] = useState<'login' | 'signup'>(mode)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = currentMode === 'login'
        ? await signIn(email, password)
        : await signUp(email, password)

      if (error) throw error
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
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
            >
              {currentMode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>

        {error && (
          <div className="p-3 text-sm rounded-md bg-destructive/10 text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
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