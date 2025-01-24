/**
 * DashboardPage.tsx
 * Main dashboard view displaying overview statistics and recent activity.
 */

import { useAuth } from '@/lib/auth/AuthContext'
import { useDashboardMetrics } from '../hooks/useDashboardMetrics'
import { Skeleton } from '@/ui/components/skeleton'
import { Alert, AlertDescription } from '@/ui/components/alert'

export function DashboardPage() {
  const { user } = useAuth()
  const { totalTickets, openTickets, avgResponseTime, loading, error } = useDashboardMetrics()

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.email}</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Dashboard metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 border rounded-lg bg-card">
          <h3 className="font-semibold mb-2">Total Tickets</h3>
          {loading ? (
            <Skeleton className="h-9 w-16" />
          ) : (
            <p className="text-3xl font-bold">{totalTickets}</p>
          )}
        </div>
        <div className="p-6 border rounded-lg bg-card">
          <h3 className="font-semibold mb-2">Open Tickets</h3>
          {loading ? (
            <Skeleton className="h-9 w-16" />
          ) : (
            <p className="text-3xl font-bold">{openTickets}</p>
          )}
        </div>
        <div className="p-6 border rounded-lg bg-card">
          <h3 className="font-semibold mb-2">Avg. Response Time</h3>
          {loading ? (
            <Skeleton className="h-9 w-16" />
          ) : (
            <p className="text-3xl font-bold">{avgResponseTime}</p>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="border rounded-lg bg-card">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Recent Activity</h2>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              No recent activity to display
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 