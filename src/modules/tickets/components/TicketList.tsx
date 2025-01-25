import { useTickets } from '../hooks/useTickets'
import { Button } from '@/ui/components/button'
import { TicketService } from '@/services/tickets'
import { useState, useEffect } from 'react'
import { EditTicketDialog } from './EditTicketDialog'
import type { Ticket, TicketStatus, TicketPriority } from '../types/ticket.types'
import { Checkbox } from '@/ui/components/checkbox'
import { supabase } from '@/services/supabase'
import { useAuth } from '@/lib/auth/AuthContext'
import { ThreadList } from './thread/ThreadList'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/dialog'
import type { Skill, SkillCategory } from '@/modules/teams/types/team.types'
import { TeamService } from '@/services/teams'

interface TicketSkill {
  id: string
  ticket_id: string
  skill_id: string
  required_proficiency: number
}

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

interface TicketCardProps {
  ticket: Ticket
  onEdit?: (ticket: Ticket) => void
  onDelete?: (ticketId: string) => void
  onReassign?: (ticketId: string) => void
  isAdmin?: boolean
  isRegularUser?: boolean
  agents: Record<string, AgentInfo>
  ticketSkills?: TicketSkill[]
  skills?: Skill[]
  selected?: boolean
  onSelect?: (ticketId: string) => void
  reassignLoading?: string | null
}

interface ThreadDialogProps {
  ticketId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ThreadDialog({ ticketId, open, onOpenChange }: ThreadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Thread Management</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <ThreadList ticketId={ticketId} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TicketCard({ 
  ticket, 
  onEdit, 
  onDelete, 
  onReassign, 
  isAdmin,
  isRegularUser = false,
  agents,
  ticketSkills = [],
  skills = [],
  selected = false,
  onSelect,
  reassignLoading
}: TicketCardProps) {
  const [showThreads, setShowThreads] = useState(false)
  const assignedAgent = ticket.assigned_to ? agents[ticket.assigned_to] : null

  return (
    <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center gap-4">
        {!isRegularUser && onSelect && (
          <div className="w-6">
            <Checkbox
              checked={selected}
              onCheckedChange={() => onSelect(ticket.id)}
            />
          </div>
        )}
        
        {/* Title and Description Column */}
        <div className="w-[400px] min-w-0">
          <span className="text-xs text-muted-foreground">#{ticket.id.split('-')[0]}</span>
          <h3 className="font-semibold truncate">{ticket.title}</h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ticket.description}</p>

          {/* Skills */}
          {ticketSkills?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {ticketSkills.map((skill) => {
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

        {/* Priority Column */}
        <div className="w-24 text-center">
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs
            ${ticket.priority === 'urgent' ? 'bg-red-100 text-red-800' : ''}
            ${ticket.priority === 'high' ? 'bg-orange-100 text-orange-800' : ''}
            ${ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' : ''}
            ${ticket.priority === 'low' ? 'bg-green-100 text-green-800' : ''}
          `}>
            {ticket.priority}
          </span>
        </div>

        {/* Status Column */}
        <div className="w-24 text-center">
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs
            ${ticket.status === 'open' ? 'bg-blue-100 text-blue-800' : ''}
            ${ticket.status === 'in_progress' ? 'bg-purple-100 text-purple-800' : ''}
            ${ticket.status === 'resolved' ? 'bg-green-100 text-green-800' : ''}
            ${ticket.status === 'closed' ? 'bg-gray-100 text-gray-800' : ''}
          `}>
            {ticket.status.replace('_', ' ')}
          </span>
        </div>

        {/* Created Date Column */}
        <div className="w-28">
          {new Date(ticket.created_at).toLocaleDateString()}
        </div>

        {/* Assignment Column */}
        {!isRegularUser && (
          <div className="w-40">
            {assignedAgent ? (
              <div className="flex flex-col">
                <span className="font-medium">{assignedAgent.full_name}</span>
                <span className="text-xs truncate">{assignedAgent.email}</span>
              </div>
            ) : (
              'Unassigned'
            )}
          </div>
        )}

        {/* Actions Column */}
        <div className="flex-1 flex justify-end gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowThreads(true)}
          >
            Manage Threads
          </Button>
          {onEdit && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onEdit(ticket)}
            >
              Edit
            </Button>
          )}
          {isAdmin && onReassign && (
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => onReassign(ticket.id)}
              title="Try to find a suitable agent based on required skills and availability"
              disabled={reassignLoading === ticket.id}
            >
              {reassignLoading === ticket.id ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
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
          )}
          {isAdmin && onDelete && (
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => onDelete(ticket.id)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Soft delete this ticket"
            >
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                />
              </svg>
            </Button>
          )}
        </div>
      </div>

      {/* Thread Dialog */}
      <ThreadDialog 
        ticketId={ticket.id}
        open={showThreads}
        onOpenChange={setShowThreads}
      />
    </div>
  )
}

/**
 * Displays a list of tickets with their status and priority
 * Handles loading and error states
 * Supports bulk actions on selected tickets
 */
export function TicketList({ filters }: TicketListProps) {
  const { user, profile } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const { tickets, loading, error, refetch } = useTickets({
    ...filters,
    assignedTo: filters?.assignmentStatus === 'unassigned' ? null :
                filters?.assignmentStatus === 'assigned' ? (filters.assignedTo || true) :
                filters?.assignedTo === 'any' ? undefined :
                filters?.assignedTo
  })
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null)
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [ticketSkills, setTicketSkills] = useState<Record<string, TicketSkill[]>>({})
  const [skills, setSkills] = useState<Skill[]>([])
  const [agents, setAgents] = useState<Record<string, AgentInfo>>({})
  const [reassignLoading, setReassignLoading] = useState<string | null>(null)

  const isRegularUser = profile?.role === 'user'

  useEffect(() => {
    // Check if user is admin
    const checkRole = async () => {
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      setIsAdmin(profile?.role === 'admin')
    }

    checkRole()
  }, [user])

  useEffect(() => {
    // Load all skills once
    TeamService.getSkills().then(result => {
      if (Array.isArray(result)) {
        setSkills(result)
      }
    })
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

    setDeleteError(null)
    const { error } = await TicketService.deleteTicket(id)
    
    if (error) {
      setDeleteError(error)
    } else {
      // Remove from selected tickets if it was selected
      if (selectedTickets.has(id)) {
        const newSelected = new Set(selectedTickets)
        newSelected.delete(id)
        setSelectedTickets(newSelected)
      }
      // Refresh the ticket list
      await refetch()
    }
  }

  const handleReassign = async (ticketId: string) => {
    setReassignLoading(ticketId)

    // Check if we have skills loaded for this ticket
    const ticketSkillsList = ticketSkills[ticketId]
    if (!ticketSkillsList?.length) {
      console.log('No skills found for ticket:', ticketId)
    }

    const { error } = await TicketService.reassignTicket(ticketId)
    
    if (error) {
      alert(error)
    } else {
      refetch()
    }
    
    setReassignLoading(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 rounded-md bg-destructive/10 text-destructive">
        <p>Error: {error}</p>
        <Button variant="outline" className="mt-2" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  if (!tickets?.length) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <p>No tickets found</p>
      </div>
    )
  }

  return (
    <>
      {/* Error Message */}
      {deleteError && (
        <div className="p-4 mb-4 rounded-md bg-destructive/10 text-destructive">
          <p>Failed to delete ticket: {deleteError}</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={() => setDeleteError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Bulk Actions - Hide for regular users */}
      {!isRegularUser && selectedTickets.size > 0 && (
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
        <div className="p-4 rounded-lg bg-muted/30">
          <div className="flex items-center gap-4">
            {!isRegularUser && (
              <div className="w-6">
                <Checkbox
                  checked={selectedTickets.size === tickets.length}
                  onCheckedChange={handleSelectAll}
                />
              </div>
            )}
            <div className="w-[400px] font-medium">Title</div>
            <div className="w-24 text-center">Priority</div>
            <div className="w-24 text-center">Status</div>
            <div className="w-28">Created</div>
            {!isRegularUser && <div className="w-40">Assigned To</div>}
            <div className="flex-1 flex justify-end">Actions</div>
          </div>
        </div>

        {/* Tickets */}
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            onEdit={(ticket) => {
              setEditingTicket(ticket)
            }}
            onDelete={handleDelete}
            onReassign={handleReassign}
            isAdmin={isAdmin}
            isRegularUser={isRegularUser}
            agents={agents}
            ticketSkills={ticketSkills[ticket.id]}
            skills={skills}
            selected={selectedTickets.has(ticket.id)}
            onSelect={handleSelectTicket}
            reassignLoading={reassignLoading}
          />
        ))}
      </div>

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