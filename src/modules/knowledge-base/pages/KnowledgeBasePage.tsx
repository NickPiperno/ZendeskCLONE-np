import { useState } from 'react'
import { ArticleSearch } from '../components/ArticleSearch'
import { CategoryList } from '../components/CategoryList'
import { ArticleList } from '../components/ArticleList'
import { ArticleView } from '../components/ArticleView'
import { NewArticleDialog } from '../components/NewArticleDialog'
import type { SearchKBArticlesResponse } from '@/services/types/knowledge-base.types'

export function KnowledgeBasePage() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<SearchKBArticlesResponse[] | undefined>()
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)

  const handleSearchResults = (results: SearchKBArticlesResponse[]) => {
    setSearchResults(results)
    setSelectedCategoryId(null)
  }

  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId)
    setSearchResults(undefined)
    setSelectedArticleId(null)
  }

  const handleArticleSelect = (articleId: string) => {
    setSelectedArticleId(articleId)
  }

  const handleBackToList = () => {
    setSelectedArticleId(null)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground">Find answers to common questions</p>
        </div>
        <NewArticleDialog />
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Left sidebar with categories */}
        <div className="col-span-1">
          <CategoryList
            selectedCategoryId={selectedCategoryId}
            onCategorySelect={handleCategorySelect}
          />
        </div>

        {/* Main content area */}
        <div className="col-span-3 space-y-6">
          {!selectedArticleId ? (
            <>
              <ArticleSearch
                onResultsFound={handleSearchResults}
                categoryId={selectedCategoryId || undefined}
              />
              <ArticleList
                searchResults={searchResults}
                categoryId={selectedCategoryId}
                onArticleSelect={handleArticleSelect}
              />
            </>
          ) : (
            <ArticleView
              articleId={selectedArticleId}
              onBack={handleBackToList}
            />
          )}
        </div>
      </div>
    </div>
  )
} 