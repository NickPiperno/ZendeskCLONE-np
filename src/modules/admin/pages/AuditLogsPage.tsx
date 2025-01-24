/**
 * AuditLogsPage.tsx
 * Displays system audit logs with filtering and search capabilities.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/services/supabase'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { Input } from '@/ui/components/input'
import { DatePickerWithRange } from '@/ui/components/date-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select'
import { Alert, AlertDescription } from '@/ui/components/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/table'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'

interface AuditLog {
  id: string
  created_at: string
  user_id: string
  action_type: string
  table_name: string
  record_id: string
  old_data: any
  new_data: any
  ip_address: string
  user_agent: string
  user_email?: string
}

export function AuditLogsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filters
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [selectedAction, setSelectedAction] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

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

  // Fetch audit logs
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true)
        let query = supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })

        // Apply filters
        if (dateRange?.from) {
          query = query.gte('created_at', dateRange.from.toISOString())
        }
        if (dateRange?.to) {
          query = query.lte('created_at', dateRange.to.toISOString())
        }
        if (selectedTable && selectedTable !== 'all') {
          query = query.eq('table_name', selectedTable)
        }
        if (selectedAction && selectedAction !== 'all') {
          query = query.eq('action_type', selectedAction)
        }
        if (searchQuery) {
          query = query.or(`user_id.ilike.%${searchQuery}%,record_id.ilike.%${searchQuery}%`)
        }

        const { data: logs, error: fetchError } = await query.limit(100)

        if (fetchError) {
          console.error('Supabase error:', fetchError)
          throw new Error(fetchError.message)
        }

        if (!logs) {
          setLogs([])
          return
        }

        // Fetch user emails in a separate query
        const userIds = [...new Set(logs.map(log => log.user_id))]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds)

        // Create a map of user IDs to emails
        const userEmailMap = new Map(
          profiles?.map(profile => [profile.id, profile.email]) || []
        )

        // Combine the data
        setLogs(logs.map(log => ({
          ...log,
          user_email: userEmailMap.get(log.user_id)
        })))
        setError(null)
      } catch (err) {
        console.error('Error fetching audit logs:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch audit logs')
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [dateRange, selectedTable, selectedAction, searchQuery])

  const formatChanges = (oldData: any, newData: any) => {
    if (!oldData && !newData) return 'No changes'
    
    const changes: string[] = []
    if (oldData && newData) {
      Object.keys(newData).forEach(key => {
        if (oldData[key] !== newData[key]) {
          changes.push(`${key}: ${oldData[key]} → ${newData[key]}`)
        }
      })
    } else if (newData) {
      changes.push('New record created')
    } else if (oldData) {
      changes.push('Record deleted')
    }
    
    return changes.join(', ')
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader 
        title="Audit Logs"
        description="View and search system audit logs"
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <DatePickerWithRange
          value={dateRange}
          onChange={setDateRange}
        />
        <Select value={selectedTable} onValueChange={setSelectedTable}>
          <SelectTrigger>
            <SelectValue placeholder="Select table" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tables</SelectItem>
            <SelectItem value="tickets">Tickets</SelectItem>
            <SelectItem value="ticket_notes">Ticket Notes</SelectItem>
            <SelectItem value="profiles">Profiles</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedAction} onValueChange={setSelectedAction}>
          <SelectTrigger>
            <SelectValue placeholder="Select action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="INSERT">Create</SelectItem>
            <SelectItem value="UPDATE">Update</SelectItem>
            <SelectItem value="DELETE">Delete</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Search by user or record ID"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Logs Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Table</TableHead>
              <TableHead>Record ID</TableHead>
              <TableHead>Changes</TableHead>
              <TableHead>IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4">
                  No audit logs found
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}</TableCell>
                  <TableCell>{log.user_email || log.user_id}</TableCell>
                  <TableCell>{log.action_type}</TableCell>
                  <TableCell>{log.table_name}</TableCell>
                  <TableCell>{log.record_id}</TableCell>
                  <TableCell className="max-w-md truncate">
                    {formatChanges(log.old_data, log.new_data)}
                  </TableCell>
                  <TableCell>{log.ip_address}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
} 