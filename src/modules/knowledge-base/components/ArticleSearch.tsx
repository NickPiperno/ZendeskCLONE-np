import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { knowledgeBaseService } from '@/services/knowledge-base'
import { Input } from '@/ui/components/input'
import { Button } from '@/ui/components/button'
import { Loader2 } from 'lucide-react'
import type { SearchKBArticlesResponse } from '@/services/types/knowledge-base.types'

interface ArticleSearchProps {
  onResultsFound: (results: SearchKBArticlesResponse[]) => void
  categoryId?: string
}

export function ArticleSearch({ onResultsFound, categoryId }: ArticleSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  
  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
      if (searchQuery.length === 0) {
        onResultsFound([])
      }
    }, 300) // 300ms delay

    return () => clearTimeout(timer)
  }, [searchQuery, onResultsFound])

  const { data: results } = useQuery({
    queryKey: ['kb-search', debouncedQuery, categoryId],
    queryFn: async () => {
      const results = await knowledgeBaseService.searchArticles(debouncedQuery, categoryId)
      onResultsFound(results)
      return results
    },
    enabled: debouncedQuery.length > 2, // Only search when query is at least 3 characters
    staleTime: 1000 * 60 * 5, // Cache results for 5 minutes
  })

  // Handle form submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
  }, [])

  const isSearching = debouncedQuery.length > 2 && !results

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        type="search"
        placeholder="Search knowledge base... (min. 3 characters)"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="flex-1"
      />
      <Button 
        type="submit" 
        variant="secondary" 
        disabled={isSearching || searchQuery.length < 3}
      >
        {isSearching ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Searching...
          </>
        ) : (
          'Search'
        )}
      </Button>
    </form>
  )
} 