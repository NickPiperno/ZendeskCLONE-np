import { useState, useEffect } from 'react'
import { supabase } from '@/services/supabase'
import { useAuth } from '@/lib/auth/AuthContext'
import { Badge } from '@/ui/components/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/select'

interface Tag {
  id: string
  name: string
  color: string
}

interface TicketTagsProps {
  ticketId: string
  className?: string
}

export function TicketTags({ ticketId, className = '' }: TicketTagsProps) {
  const [tags, setTags] = useState<Tag[]>([])
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [removingTagId, setRemovingTagId] = useState<string | null>(null)
  const { profile } = useAuth()

  // Clear error after 3 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [error])

  // Fetch ticket's tags and all available tags
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch ticket's current tags
        const { data: ticketTags, error: tagsError } = await supabase
          .from('ticket_tag_summaries')
          .select('tag_ids, tag_names, tag_colors')
          .eq('ticket_id', ticketId)
          .single()

        if (tagsError) throw tagsError

        // Fetch all available tags
        const { data: allTags, error: allTagsError } = await supabase
          .from('tags')
          .select('id, name, color')
          .order('name')

        if (allTagsError) throw allTagsError

        // Transform ticket tags into the right format
        const currentTags = ticketTags?.tag_ids?.map((id: string, index: number) => ({
          id,
          name: ticketTags.tag_names[index],
          color: ticketTags.tag_colors[index]
        })) || []

        setTags(currentTags)
        setAvailableTags(allTags)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tags')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [ticketId])

  // Add a tag to the ticket
  async function addTag(tagId: string) {
    try {
      const { error: insertError } = await supabase
        .from('ticket_tags')
        .insert({
          ticket_id: ticketId,
          tag_id: tagId,
          added_by: profile?.id
        })

      if (insertError) throw insertError

      // Refresh tags
      const tag = availableTags.find(t => t.id === tagId)
      if (tag) {
        setTags([...tags, tag])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add tag')
    }
  }

  // Remove a tag from the ticket
  async function removeTag(tagId: string) {
    setRemovingTagId(tagId)
    try {
      const { error: removeError } = await supabase.rpc('remove_ticket_tag', {
        p_ticket_id: ticketId,
        p_tag_id: tagId
      })

      if (removeError) throw removeError

      // Update local state
      setTags(tags.filter(t => t.id !== tagId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove tag')
    } finally {
      setRemovingTagId(null)
    }
  }

  if (loading) {
    return <div className="animate-pulse h-8 bg-muted rounded"></div>
  }

  // Get tags that aren't already added to the ticket
  const unusedTags = availableTags.filter(
    tag => !tags.some(t => t.id === tag.id)
  )

  return (
    <div className={`space-y-2 ${className}`}>
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-2 rounded mb-2">
          {error}
        </div>
      )}
      
      {/* Existing tags */}
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <Badge
            key={tag.id}
            variant="secondary"
            style={{ backgroundColor: tag.color }}
            className="flex items-center gap-1"
          >
            {tag.name}
            {(profile?.role === 'admin' || profile?.role === 'agent') && (
              <button
                onClick={() => removeTag(tag.id)}
                className="ml-1 hover:text-destructive"
                title="Remove tag"
                disabled={removingTagId === tag.id}
              >
                {removingTagId === tag.id ? '...' : '×'}
              </button>
            )}
          </Badge>
        ))}
        {tags.length === 0 && (
          <span className="text-sm text-muted-foreground">No tags</span>
        )}
      </div>

      {/* Add tag dropdown (admin/agent only) */}
      {(profile?.role === 'admin' || profile?.role === 'agent') && unusedTags.length > 0 && (
        <Select onValueChange={addTag}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Add tag..." />
          </SelectTrigger>
          <SelectContent>
            {unusedTags.map(tag => (
              <SelectItem key={tag.id} value={tag.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
} 