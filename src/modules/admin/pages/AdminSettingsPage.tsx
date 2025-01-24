import { useState } from 'react'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/card'
import { Button } from '@/ui/components/button'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/tabs'
import { Switch } from '@/ui/components/switch'
import { Textarea } from '@/ui/components/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select'
import { Alert, AlertDescription } from '@/ui/components/alert'
import { Eye, EyeOff } from 'lucide-react'

export function AdminSettingsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const apiKey = "sk_test_example_key_12345" // This should come from your backend

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // TODO: Implement actual save logic here
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      setSuccess(true)
    } catch (err) {
      setError('Failed to save settings')
      console.error('Error saving settings:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader 
        title="System Settings"
        description="Configure system-wide settings and defaults"
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>Settings saved successfully</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="email">Email Templates</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Defaults</CardTitle>
              <CardDescription>Configure default system behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Language</Label>
                <Select defaultValue="en" disabled={loading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Maintenance Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Temporarily disable access for non-admin users
                  </p>
                </div>
                <Switch disabled={loading} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Settings</CardTitle>
              <CardDescription>Configure default ticket behavior and SLAs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default SLA Response Time (hours)</Label>
                <Input type="number" defaultValue={24} disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label>Default Priority</Label>
                <Select defaultValue="medium" disabled={loading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-assignment</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically assign tickets to available agents
                  </p>
                </div>
                <Switch defaultChecked disabled={loading} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Templates</CardTitle>
              <CardDescription>Customize system email templates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Welcome Email</Label>
                <Textarea 
                  placeholder="Welcome email template"
                  defaultValue="Welcome to our support system! We're glad to have you here."
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label>Ticket Created</Label>
                <Textarea 
                  placeholder="Ticket created template"
                  defaultValue="Your ticket #{ticket_id} has been created. We'll get back to you soon."
                  disabled={loading}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Configure security and authentication settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Session Timeout (minutes)</Label>
                <Input type="number" defaultValue={60} disabled={loading} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Require 2FA for all admin accounts
                  </p>
                </div>
                <Switch defaultChecked disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <Input 
                      type={showApiKey ? "text" : "password"} 
                      value={apiKey} 
                      readOnly
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowApiKey(!showApiKey)}
                      disabled={loading}
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      <span className="sr-only">
                        {showApiKey ? "Hide API key" : "Show API key"}
                      </span>
                    </Button>
                  </div>
                  <Button variant="outline" disabled={loading}>Regenerate</Button>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Keep this key secure. It provides full access to your account.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>External Integrations</CardTitle>
              <CardDescription>Manage third-party service integrations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Slack Integration</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications in Slack
                    </p>
                  </div>
                  <Switch disabled={loading} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Microsoft Teams Integration</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications in Teams
                    </p>
                  </div>
                  <Switch disabled={loading} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
} 