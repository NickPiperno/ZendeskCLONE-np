import { Link, NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth/AuthContext'
import { Button } from '@/ui/components/button'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <Link to="/" className="mr-6 flex items-center space-x-2">
              <span className="font-bold">AutoCRM</span>
            </Link>
          </div>
          <nav className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <NavLink to="/dashboard" className={({ isActive }) => cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2",
              isActive ? "bg-accent text-accent-foreground" : "text-foreground"
            )}>
              Dashboard
            </NavLink>
            <NavLink to="/tickets" className={({ isActive }) => cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2",
              isActive ? "bg-accent text-accent-foreground" : "text-foreground"
            )}>
              Tickets
            </NavLink>
            {(profile?.role === 'agent' || profile?.role === 'admin') && profile?.is_active && (
              <NavLink to="/agent" className={({ isActive }) => cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2",
                isActive ? "bg-accent text-accent-foreground" : "text-foreground"
              )}>
                Agent Dashboard
              </NavLink>
            )}
            {profile?.role === 'admin' && profile?.is_active && (
              <NavLink to="/admin" className={({ isActive }) => cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2",
                isActive ? "bg-accent text-accent-foreground" : "text-foreground"
              )}>
                Admin Console
              </NavLink>
            )}
            <NavLink to="/settings" className={({ isActive }) => cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2",
              isActive ? "bg-accent text-accent-foreground" : "text-foreground"
            )}>
              Settings
            </NavLink>
            <Button variant="outline" onClick={() => signOut()}>
              Sign Out
            </Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto py-6">
        {children}
      </main>

      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-14 md:flex-row">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built with ❤️ using modern tech stack
          </p>
        </div>
      </footer>
    </div>
  )
} 