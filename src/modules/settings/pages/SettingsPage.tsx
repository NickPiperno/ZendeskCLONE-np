import { useState } from 'react'
import { Button } from '@/ui/components/button'
import { testRLSPolicies } from '@/services/test-rls'

export function SettingsPage() {
  const [rlsResults, setRlsResults] = useState<any>(null)

  const handleTestRLS = async () => {
    const results = await testRLSPolicies()
    setRlsResults(results)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Profile</h2>
          <div className="rounded-lg border p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Display Name</label>
                <input
                  type="text"
                  placeholder="Your name"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <Button>Save Changes</Button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Security</h2>
          <div className="rounded-lg border p-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">Test RLS Policies</h3>
                  <p className="text-sm text-muted-foreground">Verify Supabase security settings</p>
                </div>
                <Button onClick={handleTestRLS}>Run Test</Button>
              </div>
              {rlsResults && (
                <div className="mt-4 p-4 bg-muted rounded-md">
                  <h4 className="font-semibold mb-2">Test Results:</h4>
                  <div className="space-y-2 text-sm">
                    <p>Unauthenticated Access:</p>
                    <ul className="list-disc list-inside pl-4">
                      <li>Can Read: {rlsResults.unauthenticated.canRead ? '✅' : '❌'}</li>
                      <li>Can Write: {rlsResults.unauthenticated.canWrite ? '✅' : '❌'}</li>
                      {rlsResults.unauthenticated.error && (
                        <li className="text-destructive">Error: {rlsResults.unauthenticated.error}</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Preferences</h2>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">No preferences available yet</p>
          </div>
        </div>
      </div>
    </div>
  )
} 