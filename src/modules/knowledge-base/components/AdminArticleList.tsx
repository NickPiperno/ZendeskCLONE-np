import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { knowledgeBaseService } from '@/services/knowledge-base'
import { Card, CardHeader, CardTitle, CardContent } from '@/ui/components/card'
import { Button } from '@/ui/components/button'
import { Skeleton } from '@/ui/components/skeleton'
import { Badge } from '@/ui/components/badge'
import type { GetKBArticleResponse } from '@/services/types/knowledge-base.types'
import { useAuth } from '@/lib/auth/AuthContext'

interface AdminArticleListProps {
  onArticleSelect: (articleId: string) => void
}

export function AdminArticleList({ onArticleSelect }: AdminArticleListProps) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  // Only admins can access this component
  if (profile?.role !== 'admin') {
    console.warn('Non-admin user attempted to access AdminArticleList')
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Unauthorized: Admin access required
          </p>
        </CardContent>
      </Card>
    )
  }

  const { data: articles, isLoading, error } = useQuery<GetKBArticleResponse[], Error>({
    queryKey: ['kb-admin-articles'],
    queryFn: () => knowledgeBaseService.getAllArticlesAdmin(),
    refetchOnMount: true,
    initialData: [] // Provide initial data to avoid undefined
  })

  const togglePublicationMutation = useMutation({
    mutationFn: ({ articleId, isPublished }: { articleId: string, isPublished: boolean }) =>
      knowledgeBaseService.toggleArticlePublication(articleId, isPublished),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb-admin-articles'] })
    },
    onError: (error) => {
      console.error('Failed to toggle article publication:', error)
    }
  })

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    )
  }

  // Show error state
  if (error) {
    console.error('Error fetching articles:', error)
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-destructive">
            Error loading articles: {error.message}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!articles?.length) {
    console.info('No articles found in AdminArticleList')
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            No articles found
          </p>
        </CardContent>
      </Card>
    )
  }

  // Function to get preview text from markdown content
  const getPreviewText = (content: string) => {
    // Remove markdown headers
    const withoutHeaders = content.replace(/^#.*$/gm, '').trim()
    // Remove markdown formatting
    const plainText = withoutHeaders.replace(/[#*_`]/g, '').trim()
    // Get first 200 characters
    return plainText.slice(0, 200) + (plainText.length > 200 ? '...' : '')
  }

  return (
    <div className="space-y-4">
      {articles.map((article) => (
        <Card 
          key={article.id}
          className="relative hover:bg-accent/50 transition-colors"
        >
          {/* Publication Status Badge */}
          <div className="absolute top-4 right-4 flex gap-2">
            <Badge variant={article.is_published ? "default" : "secondary"}>
              {article.is_published ? "Published" : "Draft"}
            </Badge>
            {!article.is_published && (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  console.log('Attempting to publish article:', article.id)
                  togglePublicationMutation.mutate({
                    articleId: article.id,
                    isPublished: true
                  })
                }}
              >
                Publish
              </Button>
            )}
          </div>

          <div className="cursor-pointer" onClick={() => onArticleSelect(article.id)}>
            <CardHeader>
              <CardTitle className="text-lg">
                {article.title}
              </CardTitle>
              {article.category && (
                <p className="text-sm text-muted-foreground">
                  in {article.category.name}
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground line-clamp-2">
                {getPreviewText(article.content)}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Created: {new Date(article.created_at).toLocaleDateString()}
                {article.last_reviewed_at && (
                  <> • Last Published: {new Date(article.last_reviewed_at).toLocaleDateString()}</>
                )}
              </div>
            </CardContent>
          </div>
        </Card>
      ))}
    </div>
  )
} 