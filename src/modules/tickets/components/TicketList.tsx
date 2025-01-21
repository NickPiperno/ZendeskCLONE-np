import { useTickets } from '../hooks/useTickets'
import { Button } from '@/ui/components/button'
import { TicketService } from '@/services/tickets'
import { useState } from 'react'
import { EditTicketDialog } from './EditTicketDialog'
import type { Ticket, TicketStatus, TicketPriority } from '../types/ticket.types'
import { Checkbox } from '@/ui/components/checkbox'

interface TicketListProps {
  filters?: {
    status?: TicketStatus
    priority?: TicketPriority
  }
}

/**
 * Displays a list of tickets with their status and priority
 * Handles loading and error states
 * Supports bulk actions on selected tickets
 */
export function TicketList({ filters }: TicketListProps) {
  const { tickets, loading, error, refetch } = useTickets(filters)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null)
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)

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

  if (deleteError) {
    return (
      <div className="p-4 rounded-md bg-destructive/10 text-destructive">
        <p>Error deleting ticket: {deleteError}</p>
        <Button variant="outline" className="mt-2" onClick={() => setDeleteError(null)}>
          Dismiss
        </Button>
      </div>
    )
  }

  if (tickets.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <p>No tickets found</p>
      </div>
    )
  }

  return (
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
          <span className="w-24 text-center">Priority</span>
          <span className="w-24 text-center">Status</span>
          <span className="w-40">Created</span>
          <span className="w-32">Actions</span>
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
            </div>
            <span className={`w-24 px-2 py-1 rounded-full text-xs text-center ${
              ticket.priority === 'urgent' ? 'bg-destructive/10 text-destructive' :
              ticket.priority === 'high' ? 'bg-warning/10 text-warning' :
              'bg-muted text-muted-foreground'
            }`}>
              {ticket.priority}
            </span>
            <span className={`w-24 px-2 py-1 rounded-full text-xs text-center ${
              ticket.status === 'open' ? 'bg-primary/10 text-primary' :
              ticket.status === 'in_progress' ? 'bg-warning/10 text-warning' :
              ticket.status === 'resolved' ? 'bg-success/10 text-success' :
              'bg-muted text-muted-foreground'
            }`}>
              {ticket.status}
            </span>
            <span className="w-40 text-xs text-muted-foreground">
              {new Date(ticket.created_at).toLocaleDateString()}
            </span>
            <div className="w-32 flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setEditingTicket(ticket)}
              >
                Edit
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