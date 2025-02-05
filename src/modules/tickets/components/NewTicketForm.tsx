import { useState, useEffect } from 'react'
import { Button } from '@/ui/components/button'
import { useCreateTicket } from '../hooks/useCreateTicket'
import type { TicketPriority } from '../types/ticket.types'
import { TicketSkillsDialog } from './TicketSkillsDialog'
import { useAuth } from '@/lib/auth/AuthContext'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select'

interface NewTicketFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

interface User {
  id: string
  full_name: string
  email: string
}

/**
 * Form for creating new tickets
 * Handles validation and submission
 */
export function NewTicketForm({ onSuccess, onCancel }: NewTicketFormProps) {
  const { createTicket, loading } = useCreateTicket()
  const { isAdmin } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('medium')
  const [newTicketId, setNewTicketId] = useState<string | null>(null)
  const [skillsDialogOpen, setSkillsDialogOpen] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const queryClient = useQueryClient()
  const [errorMessage, setError] = useState<string | null>(null)

  // Fetch users if admin
  useEffect(() => {
    if (isAdmin) {
      const fetchUsers = async () => {
        const { data: users, error } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('role', 'user')
        
        if (!error && users) {
          setUsers(users)
        }
      }

      fetchUsers()
    }
  }, [isAdmin])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!title.trim() || !description.trim()) {
      return
    }

    // For admins, require user selection
    if (isAdmin && !selectedUserId) {
      setError('Please select a user for this ticket')
      return
    }

    const result = await createTicket({
      title: title.trim(),
      description: description.trim(),
      priority,
      ...(isAdmin && { user_id: selectedUserId })
    })

    if (result) {
      // Invalidate the customerTickets query to refetch the list
      queryClient.invalidateQueries({ queryKey: ['customerTickets'] })
      queryClient.invalidateQueries({ queryKey: ['ticketSummary'] })

      // Only open skills dialog for admins
      if (isAdmin) {
        setNewTicketId(result.id)
        setSkillsDialogOpen(true)
      } else {
        onSuccess?.()
      }
    }
  }

  const handleSkillsUpdated = () => {
    setSkillsDialogOpen(false)
    onSuccess?.()
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 text-sm rounded-md bg-destructive/10 text-destructive">
            {errorMessage}
          </div>
        )}
        
        {isAdmin && (
          <div className="space-y-2">
            <label htmlFor="user" className="text-sm font-medium">
              User
            </label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user..." />
              </SelectTrigger>
              <SelectContent>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      {isAdmin && newTicketId && (
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