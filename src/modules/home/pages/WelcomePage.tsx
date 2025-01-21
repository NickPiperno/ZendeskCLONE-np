import { Button } from '../../../ui/components/button'
import { useNavigate } from 'react-router-dom'

export function WelcomePage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-4xl font-bold mb-4">Welcome to AutoCRM</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Your AI-powered customer relationship management system
      </p>
      <div className="flex gap-4">
        <Button size="lg" onClick={() => navigate('/login')}>Sign In</Button>
        <Button size="lg" variant="outline" onClick={() => navigate('/signup')}>Create Account</Button>
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        Experience the future of customer support with AI assistance
      </p>
    </div>
  )
} 