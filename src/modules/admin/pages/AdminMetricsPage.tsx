/**
 * AdminMetricsPage.tsx
 * Displays system performance metrics and data usage statistics for administrators.
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthContext'
import { useAdminMetrics } from '../hooks/useAdminMetrics'
import { supabase } from '@/services/supabase'
import { Alert, AlertDescription } from '@/ui/components/alert'
import { AdminPageHeader } from '../components/AdminPageHeader'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/ui/components/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/table'

export function AdminMetricsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const {
    databaseSize,
    queryMetrics,
    ticketResolutionMetrics,
    agentPerformanceMetrics,
    loading,
    error,
    formatBytes,
    formatDuration,
    refetch
  } = useAdminMetrics()

  // Verify user is an admin
  useEffect(() => {
    const checkRole = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single()

      if (!profile || profile.role !== 'admin') {
        navigate('/dashboard')
      }
    }

    checkRole()
  }, [user, navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader 
        title="System Performance"
        description="Monitor system metrics, database usage, and performance indicators"
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">System Performance</h1>
            <p className="text-muted-foreground">Monitor system metrics and data usage</p>
          </div>
          <button
            onClick={refetch}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Refresh Metrics
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Database Size */}
          <Card>
            <CardHeader>
              <CardTitle>Database Size</CardTitle>
              <CardDescription>Storage usage by table</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Size</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {databaseSize.map((table) => (
                    <TableRow key={table.table_name}>
                      <TableCell>{table.table_name}</TableCell>
                      <TableCell>{table.row_count.toLocaleString()}</TableCell>
                      <TableCell>{formatBytes(table.total_size_bytes)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Query Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Query Performance</CardTitle>
              <CardDescription>Top 10 slowest queries</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query</TableHead>
                    <TableHead>Avg Time</TableHead>
                    <TableHead>Calls</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queryMetrics.map((query, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-xs">{query.query_type}</TableCell>
                      <TableCell>{query.avg_exec_time.toFixed(2)}ms</TableCell>
                      <TableCell>{query.calls.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Ticket Resolution Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Ticket Resolution</CardTitle>
              <CardDescription>Average resolution time by status</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Avg Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ticketResolutionMetrics.map((metric) => (
                    <TableRow key={metric.status}>
                      <TableCell className="capitalize">{metric.status}</TableCell>
                      <TableCell>{metric.ticket_count.toLocaleString()}</TableCell>
                      <TableCell>{formatDuration(metric.avg_resolution_time_minutes)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Agent Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Agent Performance</CardTitle>
              <CardDescription>Resolution metrics by agent</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Resolved</TableHead>
                    <TableHead>Avg Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentPerformanceMetrics.map((agent) => (
                    <TableRow key={agent.agent_id}>
                      <TableCell>{agent.agent_name}</TableCell>
                      <TableCell>{agent.tickets_resolved.toLocaleString()}</TableCell>
                      <TableCell>{formatDuration(agent.avg_resolution_time_minutes)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 