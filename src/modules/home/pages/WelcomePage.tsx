import { Button } from '../../../ui/components/button'

export function WelcomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-4xl font-bold mb-4">Welcome to AutoCRM</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Your AI-powered customer relationship management system
      </p>
      <div className="flex gap-4">
        <Button size="lg">Get Started</Button>
        <Button size="lg" variant="outline">Learn More</Button>
      </div>
    </div>
  )
} 