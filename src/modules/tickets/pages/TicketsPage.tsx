import { TicketList } from '../components/TicketList'
import { NewTicketDialog } from '../components/NewTicketDialog'
import { Button } from '@/ui/components/button'
import { useCreateTicket } from '../hooks/useCreateTicket'
import { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select'
import type { TicketStatus, TicketPriority } from '../types/ticket.types'
import { Label } from '@/ui/components/label'
import { supabase } from '@/services/supabase'
import { useAuth } from '@/lib/auth/AuthContext'

type AssignmentStatus = 'all' | 'assigned' | 'unassigned'

interface Agent {
  id: string
  full_name: string
  email: string
}

export function TicketsPage() {
  const { createTicket, loading, error } = useCreateTicket()
  const { profile } = useAuth()
  const [agents, setAgents] = useState<Agent[]>([])
  const [filters, setFilters] = useState({
    assignmentStatus: 'all' as AssignmentStatus,
    status: undefined as TicketStatus | undefined,
    priority: undefined as TicketPriority | undefined,
    assignedTo: undefined as string | undefined
  })

  const isRegularUser = profile?.role === 'user'

  // Only fetch agents if not a regular user
  useEffect(() => {
    if (isRegularUser) return

    const fetchAgents = async () => {
      const { data: agents, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'agent')
      
      if (!error && agents) {
        setAgents(agents)
      }
    }

    fetchAgents()
  }, [isRegularUser])

  const handleTestTicket = async () => {
    const result = await createTicket({
      title: 'Test Ticket',
      description: 'This is a test ticket to verify Supabase integration',
      priority: 'medium'
    })
    
    if (result) {
      console.log('Test ticket created successfully')
    }
  }

  const handleFilterChange = (key: string, value: string | null) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === 'any' ? undefined : value
    }))
  }

  const handleClearFilters = () => {
    setFilters({
      assignmentStatus: 'all',
      status: undefined,
      priority: undefined,
      assignedTo: undefined
    })
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Tickets</h1>
          <p className="text-muted-foreground">View and manage support tickets</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTestTicket} disabled={loading}>
            {loading ? 'Creating...' : 'Create Test Ticket'}
          </Button>
          <NewTicketDialog />
        </div>
      </div>
      
      {error && (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive">
          {error}
        </div>
      )}

      {/* Filters - Only show for non-regular users */}
      {!isRegularUser && (
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Filters</h3>
            {(filters.status || filters.priority || filters.assignmentStatus !== 'all' || filters.assignedTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear Filters
              </Button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-4">
            {/* Assignment Status Filter */}
            <div className="space-y-2">
              <Label>Assignment Status</Label>
              <Select value={filters.assignmentStatus} onValueChange={(value) => handleFilterChange('assignmentStatus', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select assignment status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tickets</SelectItem>
                  <SelectItem value="assigned">Assigned Only</SelectItem>
                  <SelectItem value="unassigned">Unassigned Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assigned To Filter */}
            <div className="space-y-2">
              <Label>Assigned To</Label>
              <Select 
                value={filters.assignedTo} 
                onValueChange={(value) => handleFilterChange('assignedTo', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Agent</SelectItem>
                  {agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filters.status || 'any'} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority Filter */}
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={filters.priority || 'any'} onValueChange={(value) => handleFilterChange('priority', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
      
      <TicketList 
        filters={isRegularUser ? undefined : {
          status: filters.status,
          priority: filters.priority,
          assignmentStatus: filters.assignmentStatus === 'all' ? undefined : filters.assignmentStatus,
          assignedTo: filters.assignedTo
        }}
      />
    </div>
  )
} 