/**
 * MessageComposer.tsx
 * Provides a tactile input experience for composing messages.
 * Implements Modern Skeuomorphic design with real-time feedback.
 */

import React, { useState } from 'react'
import { Button } from '@/ui/components/button'
import { Textarea } from '@/ui/components/textarea'
import { useThreads } from '@/hooks/useThreads'

interface MessageComposerProps {
  threadId?: string
  ticketId: string
  onMessageSent?: () => void
  placeholder?: string
}

export function MessageComposer({ 
  threadId, 
  ticketId,
  onMessageSent,
  placeholder = 'Type your message here...'
}: MessageComposerProps) {
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const { createThread, addMessage } = useThreads({ ticketId })
  const isSubmitting = createThread.isPending || addMessage.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    try {
      if (!threadId) {
        // Create new thread
        await createThread.mutate({
          ticketId,
          title: content.slice(0, 100),
          initial_message: content,
          thread_type: 'customer_initiated'
        })
      } else {
        // Add message to existing thread
        await addMessage.mutate({
          threadId,
          content
        })
      }

      // Reset form
      setContent('')
      setError('')
      onMessageSent?.()
    } catch (err) {
      setError('Failed to send message. Please try again.')
      console.error('Error sending message:', err)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        className="min-h-[100px]"
      />
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {content.length} characters
        </span>
        <Button 
          type="submit" 
          disabled={!content.trim() || isSubmitting}
        >
          {isSubmitting ? 'Sending...' : 'Send Message'}
        </Button>
      </div>
      {error && (
        <div className="text-red-500 text-sm">
          {error}
        </div>
      )}
    </form>
  )
} 