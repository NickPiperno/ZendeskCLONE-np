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
              className="text-sm text-muted-foreground line-clamp-2 [&_mark]:bg-yellow-200 dark:[&_mark]:bg-yellow-500/20"
              dangerouslySetInnerHTML={{ 
                __html: 'content_preview' in article ? article.content_preview : article.content 
              }}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  )
} 