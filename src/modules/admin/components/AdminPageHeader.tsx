import { useNavigate } from 'react-router-dom'
import { Button } from '@/ui/components/button'
import { ArrowLeft } from 'lucide-react'

interface AdminPageHeaderProps {
  title: string
  description?: string
}

export function AdminPageHeader({ title, description }: AdminPageHeaderProps) {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col space-y-2 mb-6">
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin')}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
    </div>
  )
} 