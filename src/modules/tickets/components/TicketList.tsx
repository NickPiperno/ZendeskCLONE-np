import { useTickets } from '../hooks/useTickets'
import { Button } from '@/ui/components/button'
import { TicketService } from '@/services/tickets'
import { useState, useEffect } from 'react'
import { EditTicketDialog } from './EditTicketDialog'
import type { Ticket, TicketStatus, TicketPriority } from '../types/ticket.types'
import { Checkbox } from '@/ui/components/checkbox'
import { TeamService } from '@/services/teams'
import { supabase } from '@/services/supabase'
import { Select } from '@/ui/components/select'

type SkillCategory = 'technical' | 'product' | 'language' | 'soft_skill'

interface Skill {
  id: string
  name: string
  category: SkillCategory
}

interface TicketSkill {
  id: string
  ticket_id: string
  skill_id: string
  required_proficiency: number
}

type FilterKey = 'status' | 'priority' | 'assignedTo' | 'assignmentStatus'

interface TicketListProps {
  filters?: {
    status?: TicketStatus
    priority?: TicketPriority
    assignedTo?: string
    assignmentStatus?: 'assigned' | 'unassigned' | 'all'
  }
}

interface AgentInfo {
  id: string
  full_name: string
  email: string
}

/**
 * Displays a list of tickets with their status and priority
 * Handles loading and error states
 * Supports bulk actions on selected tickets
 */
export function TicketList({ filters: initialFilters }: TicketListProps) {
  const [filters, setFilters] = useState(initialFilters || {})
  
  // Update useTickets hook to use the current filters state
  const { tickets, loading, error, refetch } = useTickets({
    ...filters,
    assignedTo: filters.assignmentStatus === 'unassigned' ? null :
                filters.assignmentStatus === 'assigned' ? (filters.assignedTo || true) :
                undefined
  })
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null)
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [ticketSkills, setTicketSkills] = useState<Record<string, TicketSkill[]>>({})
  const [skills, setSkills] = useState<Skill[]>([])
  const [agents, setAgents] = useState<Record<string, AgentInfo>>({})
  const [reassignLoading, setReassignLoading] = useState<string | null>(null)
  const [allAgents, setAllAgents] = useState<AgentInfo[]>([])

  useEffect(() => {
    // Load all skills once
    TeamService.getSkills().then(setSkills)
  }, [])

  useEffect(() => {
    // Load skills for each ticket
    const loadSkills = async () => {
      const skillsMap: Record<string, TicketSkill[]> = {}
      
      for (const ticket of tickets) {
        const result = await TicketService.getTicketSkills(ticket.id)
        if (Array.isArray(result)) {
          skillsMap[ticket.id] = result
        }
      }
      
      setTicketSkills(skillsMap)
    }

    if (tickets.length > 0) {
      loadSkills()
    }
  }, [tickets])

  useEffect(() => {
    // Load agent information for assigned tickets
    const loadAgents = async () => {
      const assignedAgentIds = tickets
        .map(t => t.assigned_to)
        .filter((id): id is string => id !== null && id !== undefined)
      
      if (assignedAgentIds.length === 0) return

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', assignedAgentIds)

      if (error) {
        console.error('Error loading agents:', error)
        return
      }

      const agentMap: Record<string, AgentInfo> = {}
      for (const agent of data) {
        agentMap[agent.id] = agent
      }
      setAgents(agentMap)
    }

    if (tickets.length > 0) {
      loadAgents()
    }
  }, [tickets])

  // Load all agents for the filter dropdown
  useEffect(() => {
    const loadAllAgents = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'agent')
        .eq('is_active', true)
        .order('full_name')

      if (error) {
        console.error('Error loading agents:', error)
        return
      }

      setAllAgents(data)
    }

    loadAllAgents()
  }, [])

  const handleSelectAll = () => {
    if (selectedTickets.size === tickets.length) {
      setSelectedTickets(new Set())
    } else {
      setSelectedTickets(new Set(tickets.map(t => t.id)))
    }
  }

  const handleSelectTicket = (ticketId: string) => {
    const newSelected = new Set(selectedTickets)
    if (newSelected.has(ticketId)) {
      newSelected.delete(ticketId)
    } else {
      newSelected.add(ticketId)
    }
    setSelectedTickets(newSelected)
  }

  const handleBulkStatusUpdate = async (status: TicketStatus) => {
    if (selectedTickets.size === 0) return

    setBulkActionLoading(true)
    const promises = Array.from(selectedTickets).map(id =>
      TicketService.updateTicket(id, { status })
    )

    try {
      await Promise.all(promises)
      setSelectedTickets(new Set())
      refetch()
    } catch (error) {
      console.error('Bulk update failed:', error)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this ticket?')) {
      return
    }

    setDeleteLoading(id)
    setDeleteError(null)

    const { error } = await TicketService.deleteTicket(id)
    
    if (error) {
      setDeleteError(error)
    } else {
      refetch()
    }
    
    setDeleteLoading(null)
  }

  const handleReassign = async (ticketId: string) => {
    setReassignLoading(ticketId)

    const { error } = await TicketService.reassignTicket(ticketId)
    
    if (error) {
      // Show error in a toast or alert
      alert(error)
    } else {
      refetch()
    }
    
    setReassignLoading(null)
  }

  const handleFilterChange = (key: FilterKey, value: string | null) => {
    setFilters(prev => {
      const newFilters = { ...prev }
      if (value === null) {
        delete newFilters[key]
      } else {
        newFilters[key] = value as any // Safe because we control the keys and values
      }

      // Clear assignedTo when changing assignment status to unassigned
      if (key === 'assignmentStatus' && value === 'unassigned') {
        delete newFilters.assignedTo
      }

      return newFilters
    })
  }

  const handleClearFilters = () => {
    setFilters({})
  }

  return (
    <>
      {/* Filters - Always show these */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Filters</h3>
          {(filters.status || filters.priority || filters.assignmentStatus || filters.assignedTo) && (
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
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Assignment Status
            </label>
            <Select
              value={filters.assignmentStatus || 'all'}
              onValueChange={(value) => handleFilterChange('assignmentStatus', value)}
            >
              <option value="all">All Tickets</option>
              <option value="assigned">Assigned Only</option>
              <option value="unassigned">Unassigned Only</option>
            </Select>
          </div>

          {/* Assigned Agent Filter */}
          {(filters.assignmentStatus === 'all' || filters.assignmentStatus === 'assigned') && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Assigned To
              </label>
              <Select
                value={filters.assignedTo || ''}
                onValueChange={(value) => handleFilterChange('assignedTo', value || null)}
              >
                <option value="">Any Agent</option>
                {allAgents.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.full_name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Status Filter */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Status
            </label>
            <Select
              value={filters.status || ''}
              onValueChange={(value) => handleFilterChange('status', value || null)}
            >
              <option value="">Any Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </Select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Priority
            </label>
            <Select
              value={filters.priority || ''}
              onValueChange={(value) => handleFilterChange('priority', value || null)}
            >
              <option value="">Any Priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Error States */}
      {error && (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive">
          <p>Error: {error}</p>
          <Button variant="outline" className="mt-2" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      )}

      {deleteError && (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive">
          <p>Error deleting ticket: {deleteError}</p>
          <Button variant="outline" className="mt-2" onClick={() => setDeleteError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* No Tickets State */}
      {!loading && !error && tickets.length === 0 && (
        <div className="text-center p-8 text-muted-foreground">
          <p>No tickets found</p>
        </div>
      )}

      {/* Ticket List */}
      {!loading && !error && tickets.length > 0 && (
        <>
          {/* Bulk Actions */}
          {selectedTickets.size > 0 && (
            <div className="bg-muted/50 p-4 rounded-lg mb-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedTickets.size} ticket{selectedTickets.size === 1 ? '' : 's'} selected
              </span>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkStatusUpdate('in_progress')}
                  disabled={bulkActionLoading}
                >
                  Mark In Progress
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkStatusUpdate('resolved')}
                  disabled={bulkActionLoading}
                >
                  Mark Resolved
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkStatusUpdate('closed')}
                  disabled={bulkActionLoading}
                >
                  Mark Closed
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
              <Checkbox
                checked={selectedTickets.size === tickets.length}
                onCheckedChange={handleSelectAll}
              />
              <span className="flex-1 font-medium">Title</span>
              <span className="w-28 text-center">Priority</span>
              <span className="w-28 text-center">Status</span>
              <span className="w-32">Created</span>
              <span className="w-48">Assigned To</span>
              <span className="w-40 text-right">Actions</span>
            </div>

            {/* Tickets */}
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm flex items-center gap-4"
              >
                <Checkbox
                  checked={selectedTickets.has(ticket.id)}
                  onCheckedChange={() => handleSelectTicket(ticket.id)}
                />
                <div className="flex-1">
                  <h3 className="font-semibold">{ticket.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{ticket.description}</p>
                  {/* Display skills */}
                  {ticketSkills[ticket.id]?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {ticketSkills[ticket.id].map((skill) => {
                        const skillInfo = skills.find(s => s.id === skill.skill_id)
                        const categoryColors: Record<SkillCategory, string> = {
                          technical: 'bg-blue-100 text-blue-800',
                          product: 'bg-purple-100 text-purple-800',
                          language: 'bg-green-100 text-green-800',
                          soft_skill: 'bg-amber-100 text-amber-800'
                        }
                        const colorClass = skillInfo ? categoryColors[skillInfo.category] : 'bg-muted'
                        
                        return (
                          <span
                            key={skill.id}
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${colorClass}`}
                            title={`${skillInfo?.category.replace('_', ' ').toUpperCase()} - Required Proficiency: ${skill.required_proficiency}`}
                          >
                            {skillInfo?.name} ({skill.required_proficiency})
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
                <span className="w-28 text-center">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium
                    ${ticket.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                      ticket.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                      ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'}`}
                  >
                    {ticket.priority}
                  </span>
                </span>
                <span className="w-28 text-center">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium
                    ${ticket.status === 'open' ? 'bg-blue-100 text-blue-800' :
                      ticket.status === 'in_progress' ? 'bg-purple-100 text-purple-800' :
                      ticket.status === 'resolved' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'}`}
                  >
                    {ticket.status}
                  </span>
                </span>
                <span className="w-32 text-sm text-muted-foreground">
                  {new Date(ticket.created_at).toLocaleDateString()}
                </span>
                <span className="w-48 text-sm">
                  {ticket.assigned_to ? (
                    <div className="flex flex-col">
                      <span className="font-medium">{agents[ticket.assigned_to]?.full_name || 'Loading...'}</span>
                      <span className="text-xs text-muted-foreground">{agents[ticket.assigned_to]?.email}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </span>
                <div className="w-40 flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setEditingTicket(ticket)}
                  >
                    Edit
                  </Button>
                  <Button 
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReassign(ticket.id)}
                    disabled={reassignLoading === ticket.id}
                    title="Try to find a suitable agent based on required skills and availability"
                  >
                    {reassignLoading === ticket.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                    ) : (
                      <svg 
                        className="h-4 w-4" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                        />
                      </svg>
                    )}
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => handleDelete(ticket.id)}
                    disabled={deleteLoading === ticket.id}
                  >
                    {deleteLoading === ticket.id ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Edit Dialog */}
      {editingTicket && (
        <EditTicketDialog
          ticket={editingTicket}
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditingTicket(null)
          }}
          onSuccess={() => {
            setEditingTicket(null)
            refetch()
          }}
        />
      )}
    </>
  )
} 