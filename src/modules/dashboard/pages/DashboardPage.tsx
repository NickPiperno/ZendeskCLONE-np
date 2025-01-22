/**
 * DashboardPage.tsx
 * Main dashboard view displaying overview statistics and recent activity.
 */

import { useAuth } from '@/lib/auth/AuthContext'

export function DashboardPage() {
  const { user } = useAuth()

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.email}</p>
      </div>

      {/* Placeholder for dashboard metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 border rounded-lg">
          <h3 className="font-semibold mb-2">Total Tickets</h3>
          <p className="text-3xl font-bold">--</p>
        </div>
        <div className="p-6 border rounded-lg">
          <h3 className="font-semibold mb-2">Open Tickets</h3>
          <p className="text-3xl font-bold">--</p>
        </div>
        <div className="p-6 border rounded-lg">
          <h3 className="font-semibold mb-2">Avg. Response Time</h3>
          <p className="text-3xl font-bold">--</p>
        </div>
      </div>

      {/* Placeholder for recent activity */}
      <div className="border rounded-lg">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Recent Activity</h2>
        </div>
        <div className="p-4 text-center text-muted-foreground">
          No recent activity to display
        </div>
      </div>
    </div>
  )
} 