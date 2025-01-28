/**
 * MessageComposer.tsx
 * Provides a tactile input experience for composing messages.
 * Implements Modern Skeuomorphic design with real-time feedback.
 */

import React, { useState } from 'react'
import { Button } from '@/ui/components/button'
import { Textarea } from '@/ui/components/textarea'
import { useThreads } from '@/hooks/useThreads'
import { useAuth } from '@/lib/auth/AuthContext'
import type { MessageType } from '../../types/thread.types'

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
  const { createThread, addMessage, threads } = useThreads({ ticketId })
  const { profile } = useAuth()
  const isSubmitting = createThread.isPending || addMessage.isPending

  // Determine message type based on user role
  const getMessageType = (): MessageType => {
    if (!profile) return 'customer' // Default to customer if no profile
    switch (profile.role) {
      case 'admin':
      case 'agent':
        return 'agent'
      default:
        return 'customer'
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!content.trim()) return

    try {
      if (!threadId) {
        // Check if there's already a thread for this ticket
        const existingThread = threads?.find(t => !t.deleted)
        
        if (existingThread) {
          // Use existing thread instead of creating a new one
          await addMessage.mutate({
            threadId: existingThread.id,
            content,
            message_type: getMessageType()
          })
        } else {
          // Create new thread only if none exists
          await createThread.mutate({
            ticketId,
            title: content.slice(0, 100),
            initial_message: content,
            thread_type: getMessageType() === 'customer' ? 'customer_initiated' : 'agent_initiated'
          })
        }
      } else {
        // Add message to existing thread
        await addMessage.mutate({
          threadId,
          content,
          message_type: getMessageType()
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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyPress}
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