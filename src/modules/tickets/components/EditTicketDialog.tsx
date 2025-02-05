import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/ui/components/dialog"
import { Button } from "@/ui/components/button"
import { useState } from "react"
import { TicketService } from "@/services/tickets"
import { TicketNotes } from "./TicketNotes"
import { TicketTags } from "./TicketTags"
import { TicketSkillsDialog } from "./TicketSkillsDialog"
import type { Ticket, TicketStatus, TicketPriority } from "../types/ticket.types"
import { useQueryClient } from '@tanstack/react-query'

interface EditTicketFormProps {
  ticket: Ticket
  onSuccess?: () => void
  onCancel?: () => void
}

function EditTicketForm({ ticket, onSuccess, onCancel }: EditTicketFormProps) {
  const [title, setTitle] = useState(ticket.title)
  const [description, setDescription] = useState(ticket.description)
  const [status, setStatus] = useState<TicketStatus>(ticket.status)
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!title.trim() || !description.trim()) {
      return
    }

    setLoading(true)
    setError(null)

    const { error } = await TicketService.updateTicket(ticket.id, {
      title: title.trim(),
      description: description.trim(),
      status,
      priority
    })

    setLoading(false)

    if (error) {
      setError(error)
    } else {
      queryClient.invalidateQueries({
        queryKey: ['ticketTimeline', ticket.id]
      })
      onSuccess?.()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 text-sm rounded-md bg-destructive/10 text-destructive">
          {error}
        </div>
      )}
      
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="Enter ticket title"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="description" className="text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border rounded-md min-h-[100px]"
            placeholder="Describe the issue..."
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="status" className="text-sm font-medium">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TicketStatus)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="priority" className="text-sm font-medium">
              Priority
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Tags</label>
          <TicketTags ticketId={ticket.id} />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}

interface EditTicketDialogProps {
  ticket: Ticket
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function EditTicketDialog({ ticket, open, onOpenChange, onSuccess }: EditTicketDialogProps) {
  const [skillsDialogOpen, setSkillsDialogOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Ticket</DialogTitle>
          <DialogDescription>
            Update ticket details, manage skills, and add notes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <EditTicketForm
            ticket={ticket}
            onSuccess={onSuccess}
            onCancel={() => onOpenChange(false)}
          />

          {/* Skills Section */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Required Skills</h3>
              <Button
                variant="outline"
                onClick={() => setSkillsDialogOpen(true)}
              >
                Manage Skills
              </Button>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold">Notes & Updates</h3>
            <TicketNotes ticketId={ticket.id} />
          </div>
        </div>
      </DialogContent>

      <TicketSkillsDialog
        ticketId={ticket.id}
        open={skillsDialogOpen}
        onOpenChange={setSkillsDialogOpen}
        onSkillsUpdated={onSuccess}
      />
    </Dialog>
  )
} 