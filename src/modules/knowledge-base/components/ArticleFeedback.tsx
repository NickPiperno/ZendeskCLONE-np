import { useState } from 'react'
import { knowledgeBaseService } from '@/services/knowledge-base'
import { Button } from '@/ui/components/button'
import { Card, CardContent } from '@/ui/components/card'
import { Textarea } from '@/ui/components/textarea'

interface ArticleFeedbackProps {
  articleId: string
  helpfulCount: number
  notHelpfulCount: number
}

export function ArticleFeedback({ articleId, helpfulCount, notHelpfulCount }: ArticleFeedbackProps) {
  const [feedback, setFeedback] = useState<boolean | null>(null)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (isHelpful: boolean) => {
    setIsSubmitting(true)
    try {
      await knowledgeBaseService.submitFeedback(articleId, isHelpful, comment)
      setFeedback(isHelpful)
      setSubmitted(true)
    } catch (error) {
      console.error('Error submitting feedback:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-center text-muted-foreground">
            Thank you for your feedback!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="py-6 space-y-4">
        <p className="text-center font-medium">Was this article helpful?</p>
        
        <div className="flex justify-center gap-4">
          <Button
            variant="outline"
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting}
          >
            👍 Yes ({helpfulCount})
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
          >
            👎 No ({notHelpfulCount})
          </Button>
        </div>

        {feedback !== null && !submitted && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Would you like to provide additional feedback?
            </p>
            <Textarea
              placeholder="Your feedback (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
} 