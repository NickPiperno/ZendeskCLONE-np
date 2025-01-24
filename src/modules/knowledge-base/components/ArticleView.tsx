import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { knowledgeBaseService } from '@/services/knowledge-base'
import { Card, CardHeader, CardTitle, CardContent } from '@/ui/components/card'
import { Button } from '@/ui/components/button'
import { Skeleton } from '@/ui/components/skeleton'
import { ArticleFeedback } from '@/modules/knowledge-base/components/ArticleFeedback'
import type { GetKBArticleResponse } from '@/services/types/knowledge-base.types'

interface ArticleViewProps {
  articleId: string
  onBack: () => void
}

export function ArticleView({ articleId, onBack }: ArticleViewProps) {
  const { data: article, isLoading } = useQuery<GetKBArticleResponse | null>({
    queryKey: ['kb-article', articleId],
    queryFn: () => knowledgeBaseService.getArticle(articleId)
  })

  // Increment view count when article is viewed
  useEffect(() => {
    if (articleId) {
      knowledgeBaseService.incrementViewCount(articleId)
    }
  }, [articleId])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    )
  }

  if (!article) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Article not found</p>
          <Button onClick={onBack} variant="ghost" className="mt-4">
            Back to articles
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Button onClick={onBack} variant="ghost">
        ← Back to articles
      </Button>

      <Card>
        <CardHeader>
          <div className="space-y-2">
            {article.category && (
              <p className="text-sm text-muted-foreground">
                {article.category.name}
              </p>
            )}
            <CardTitle className="text-2xl">{article.title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          {article.content}
        </CardContent>
      </Card>

      <ArticleFeedback 
        articleId={articleId}
        helpfulCount={article.feedback_summary.helpful_count}
        notHelpfulCount={article.feedback_summary.not_helpful_count}
      />
    </div>
  )
} 