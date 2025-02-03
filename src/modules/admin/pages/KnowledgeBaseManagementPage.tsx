import { useNavigate } from 'react-router-dom'
import { AdminArticleList } from '@/modules/knowledge-base/components/AdminArticleList'
import { AdminPageHeader } from '@/modules/admin/components/AdminPageHeader'
import { Button } from '@/ui/components/button'
import { PlusIcon } from '@radix-ui/react-icons'

export function KnowledgeBaseManagementPage() {
  const navigate = useNavigate()

  const handleArticleSelect = (articleId: string) => {
    navigate(`/kb/articles/${articleId}`)
  }

  const handleNewArticle = () => {
    navigate('/kb/articles/new')
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <AdminPageHeader 
          title="Knowledge Base Management" 
          description="Manage articles, categories, and content"
        />
        <Button onClick={handleNewArticle}>
          <PlusIcon className="mr-2 h-4 w-4" />
          New Article
        </Button>
      </div>

      <AdminArticleList onArticleSelect={handleArticleSelect} />
    </div>
  )
} 