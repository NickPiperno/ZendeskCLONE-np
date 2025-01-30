import { useQuery } from '@tanstack/react-query'
import { knowledgeBaseService } from '@/services/knowledge-base'
import { Card, CardHeader, CardTitle, CardContent } from '@/ui/components/card'
import { Skeleton } from '@/ui/components/skeleton'
import type { KBArticle, SearchKBArticlesResponse } from '@/services/types/knowledge-base.types'

interface ArticleListProps {
  searchResults?: SearchKBArticlesResponse[]
  categoryId?: string | null
  onArticleSelect: (articleId: string) => void
}

export function ArticleList({ searchResults, categoryId, onArticleSelect }: ArticleListProps) {
  const { data: categoryArticles, isLoading: categoryLoading } = useQuery<KBArticle[], Error>({
    queryKey: ['kb-category-articles', categoryId],
    queryFn: () => categoryId ? knowledgeBaseService.getCategoryArticles(categoryId) : Promise.resolve([]),
    enabled: !searchResults && categoryId != null,
    gcTime: 0,  // Don't keep the data in cache
    refetchOnMount: true  // Always refetch when component mounts
  })

  // Show loading state
  if (categoryLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    )
  }

  // Show search results if available
  const articles: (KBArticle | SearchKBArticlesResponse)[] = searchResults || categoryArticles || []

  if (!articles.length) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            {searchResults ? 'No search results found' : 'No articles in this category'}
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
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => onArticleSelect(article.id)}
        >
          <CardHeader>
            <CardTitle className="text-lg">
              {article.title}
            </CardTitle>
            {'category' in article && article.category && (
              <p className="text-sm text-muted-foreground">
                in {article.category.name}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div 
              className="text-sm text-muted-foreground line-clamp-2"
            >
              {'content_preview' in article ? (
                <div dangerouslySetInnerHTML={{ __html: article.content_preview }} />
              ) : (
                getPreviewText(article.content)
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
} 