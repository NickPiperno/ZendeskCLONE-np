import { useState, useEffect } from 'react'
import { Button } from '@/ui/components/button'
import { testDatabase } from '@/services/test-db'
import { AuthService } from '@/services/auth'

export function TestDbPage() {
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    testDatabase().then(setResults)
  }, [])

  const handleTest = async () => {
    setLoading(true)
    setError(null)
    try {
      const results = await testDatabase()
      setResults(results)
    } catch (err) {
      console.error('Test failed:', err)
      setError(err instanceof Error ? err.message : 'Test failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await AuthService.signOut()
    // The user will be redirected to the login page automatically
  }

  if (!results) return <div>Loading...</div>

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Database Test</h1>
        <Button onClick={handleSignOut} variant="destructive">Sign Out</Button>
      </div>

      <div>
        <p className="text-muted-foreground">Test database structure and migrations</p>
      </div>

      {results?.roleUpdated && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          Your role has been updated to admin. Please sign out and sign back in for the changes to take effect.
        </div>
      )}

      <div className="space-y-4">
        <Button 
          onClick={handleTest}
          disabled={loading}
        >
          {loading ? 'Testing...' : 'Run Test'}
        </Button>

        {error && (
          <div className="p-4 rounded-md bg-destructive/10 text-destructive">
            {error}
          </div>
        )}

        {results && (
          <div className="space-y-4">
            <div className="rounded-md border p-4">
              <h2 className="text-lg font-semibold mb-2">Current User</h2>
              <pre className="text-sm bg-muted p-2 rounded">
                {JSON.stringify(results.user, null, 2)}
              </pre>
            </div>

            <div className="rounded-md border p-4">
              <h2 className="text-lg font-semibold mb-2">Current Profile</h2>
              <pre className="text-sm bg-muted p-2 rounded">
                {JSON.stringify(results.currentProfile, null, 2)}
              </pre>
            </div>

            <div className="rounded-md border p-4">
              <h2 className="text-lg font-semibold mb-2">All Profiles Query</h2>
              <pre className="text-sm bg-muted p-2 rounded">
                {JSON.stringify(results.profiles, null, 2)}
              </pre>
            </div>

            {results.create?.data && (
              <div className="rounded-md border p-4">
                <h2 className="text-lg font-semibold mb-2">Profile Creation Result</h2>
                <pre className="text-sm bg-muted p-2 rounded">
                  {JSON.stringify(results.create, null, 2)}
                </pre>
              </div>
            )}

            <div className="rounded-md border p-4">
              <h2 className="text-lg font-semibold mb-2">Table Information</h2>
              {results.error ? (
                <div className="p-4 rounded-md bg-destructive/10 text-destructive">
                  <p className="font-semibold">Error: {results.error.message}</p>
                  {results.error.details && <p className="mt-2">Details: {results.error.details}</p>}
                  {results.error.hint && <p className="mt-2">Hint: {results.error.hint}</p>}
                </div>
              ) : (
                <pre className="text-sm bg-muted p-2 rounded">
                  {JSON.stringify(results.tableInfo, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 