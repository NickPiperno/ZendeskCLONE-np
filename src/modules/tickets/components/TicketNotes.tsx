import { useState } from 'react'
import { Button } from '@/ui/components/button'
import { Textarea } from '@/ui/components/textarea'
import { Checkbox } from '@/ui/components/checkbox'
import { useTicketNotes } from '../hooks/useTicketNotes'
import { TicketNoteService } from '@/services/ticket-notes'
import { useAuth } from '@/lib/auth/AuthContext'
import type { TicketNote } from '../types/ticket-note.types'

interface TicketNotesProps {
  ticketId: string
}

/**
 * Component for displaying and managing ticket notes
 * Supports internal-only notes and real-time updates
 */
export function TicketNotes({ ticketId }: TicketNotesProps) {
  const { notes, loading, error, refetch } = useTicketNotes(ticketId)
  const { profile } = useAuth()
  const [newNote, setNewNote] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Check if user can create internal notes
  const canCreateInternalNotes = profile?.role === 'admin' || profile?.role === 'agent'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!newNote.trim()) {
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    const { error } = await TicketNoteService.createNote({
      ticket_id: ticketId,
      content: newNote.trim(),
      is_internal: canCreateInternalNotes && isInternal
    })

    setSubmitting(false)

    if (error) {
      setSubmitError(error)
    } else {
      setNewNote('')
      refetch()
    }
  }

  async function handleDelete(note: TicketNote) {
    if (!confirm('Are you sure you want to delete this note?')) {
      return
    }

    const { error } = await TicketNoteService.deleteNote(note.id)
    
    if (error) {
      alert(error)
    } else {
      refetch()
    }
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

  return (
    <div className="space-y-6">
      {/* New Note Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && (
          <div className="p-3 text-sm rounded-md bg-destructive/10 text-destructive">
            {submitError}
          </div>
        )}
        
        <div className="space-y-2">
          <Textarea
            value={newNote}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewNote(e.target.value)}
            placeholder="Add a note..."
            className="min-h-[80px]"
            required
          />
          {canCreateInternalNotes && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="is-internal"
                checked={isInternal}
                onCheckedChange={(checked) => setIsInternal(checked as boolean)}
              />
              <label htmlFor="is-internal" className="text-sm text-muted-foreground">
                Internal note (only visible to team members)
              </label>
            </div>
          )}
        </div>

        <Button type="submit" disabled={submitting}>
          {submitting ? 'Adding Note...' : 'Add Note'}
        </Button>
      </form>

      {/* Notes List */}
      <div className="space-y-4">
        {notes.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No notes yet
          </p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className={`p-4 rounded-lg border ${
                note.is_internal ? 'bg-muted/30' : 'bg-card'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {new Date(note.created_at).toLocaleDateString()} at{' '}
                      {new Date(note.created_at).toLocaleTimeString()} • {note.profiles.full_name}
                    </span>
                    {note.is_internal && (
                      <span className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                        Internal
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap">{note.content}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(note)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
} 