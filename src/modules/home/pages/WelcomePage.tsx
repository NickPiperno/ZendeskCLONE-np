import { Button } from '@/ui/components/button'
import { useNavigate } from 'react-router-dom'

export function WelcomePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95">
      {/* Hero Section */}
      <div className="container mx-auto px-4 pt-20 pb-16">
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70 animate-fade-in">
            Welcome to AutoCRM
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Experience the future of customer support with our AI-powered platform. 
            Streamline your workflow, enhance customer satisfaction, and boost team productivity.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button size="lg" onClick={() => navigate('/login')} className="shadow-lg hover:shadow-xl transition-shadow">
              Sign In
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/signup')} className="shadow-lg hover:shadow-xl transition-shadow">
              Create Account
            </Button>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Why Choose AutoCRM?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            title="AI-Powered Support"
            description="Leverage cutting-edge AI to automate responses and streamline customer interactions"
            icon="🤖"
          />
          <FeatureCard
            title="Team Collaboration"
            description="Work seamlessly with your team through shared inboxes and real-time updates"
            icon="👥"
          />
          <FeatureCard
            title="Smart Analytics"
            description="Gain valuable insights into customer satisfaction and team performance"
            icon="📊"
          />
        </div>
      </div>

      {/* Stats Section */}
      <div className="container mx-auto px-4 py-16 border-t">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <StatCard number="99%" text="Customer Satisfaction" />
          <StatCard number="24/7" text="Support Coverage" />
          <StatCard number="50%" text="Faster Resolution" />
        </div>
      </div>

      {/* Footer CTA */}
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to Transform Your Customer Support?</h2>
        <p className="text-muted-foreground mb-8">
          Join thousands of businesses already using AutoCRM to deliver exceptional customer service.
        </p>
        <Button size="lg" onClick={() => navigate('/signup')} className="shadow-lg hover:shadow-xl transition-shadow">
          Get Started Now
        </Button>
      </div>
    </div>
  )
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}

function StatCard({ number, text }: { number: string; text: string }) {
  return (
    <div className="space-y-2">
      <div className="text-4xl font-bold text-primary">{number}</div>
      <div className="text-muted-foreground">{text}</div>
    </div>
  )
} 