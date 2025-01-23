import { useState } from 'react'
import { Button } from '@/ui/components/button'
import { useCreateTicket } from '../hooks/useCreateTicket'
import type { TicketPriority } from '../types/ticket.types'
import { TicketSkillsDialog } from './TicketSkillsDialog'

interface NewTicketFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

/**
 * Form for creating new tickets
 * Handles validation and submission
 */
export function NewTicketForm({ onSuccess, onCancel }: NewTicketFormProps) {
  const { createTicket, loading, error } = useCreateTicket()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('medium')
  const [newTicketId, setNewTicketId] = useState<string | null>(null)
  const [skillsDialogOpen, setSkillsDialogOpen] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!title.trim() || !description.trim()) {
      return
    }

    const result = await createTicket({
      title: title.trim(),
      description: description.trim(),
      priority
    })

    if (result) {
      // Open skills dialog after ticket is created
      setNewTicketId(result.id)
      setSkillsDialogOpen(true)
    }
  }

  const handleSkillsUpdated = () => {
    setSkillsDialogOpen(false)
    onSuccess?.()
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm rounded-md bg-destructive/10 text-destructive">
            {error}
          </div>
        )}
        
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

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Ticket'}
          </Button>
        </div>
      </form>

      {newTicketId && (
        <TicketSkillsDialog
          ticketId={newTicketId}
          open={skillsDialogOpen}
          onOpenChange={(open) => {
            setSkillsDialogOpen(open)
            if (!open) {
              onSuccess?.()
            }
          }}
          onSkillsUpdated={handleSkillsUpdated}
        />
      )}
    </>
  )
} 