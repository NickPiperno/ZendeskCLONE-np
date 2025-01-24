import { useQuery } from '@tanstack/react-query'
import { knowledgeBaseService } from '@/services/knowledge-base'
import { Button } from '@/ui/components/button'
import { Card } from '@/ui/components/card'
import { Skeleton } from '@/ui/components/skeleton'
import type { KBCategory } from '@/services/types/knowledge-base.types'

interface CategoryListProps {
  onCategorySelect: (categoryId: string | null) => void
  selectedCategoryId: string | null
}

export function CategoryList({ onCategorySelect, selectedCategoryId }: CategoryListProps) {
  const { data: categories, isLoading } = useQuery<KBCategory[]>({
    queryKey: ['kb-categories'],
    queryFn: () => knowledgeBaseService.getCategories()
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    )
  }

  if (!categories?.length) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">No categories found</p>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      <Button
        variant={selectedCategoryId === null ? "secondary" : "ghost"}
        className="w-full justify-start"
        onClick={() => onCategorySelect(null)}
      >
        All Articles
      </Button>
      {categories.map((category) => (
        <Button
          key={category.id}
          variant={selectedCategoryId === category.id ? "secondary" : "ghost"}
          className="w-full justify-start"
          onClick={() => onCategorySelect(category.id)}
        >
          {category.name}
        </Button>
      ))}
    </div>
  )
} 