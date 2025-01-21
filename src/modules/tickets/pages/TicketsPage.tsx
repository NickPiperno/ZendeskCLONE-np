import { TicketList } from '../components/TicketList'
import { NewTicketDialog } from '../components/NewTicketDialog'
import { Button } from '@/ui/components/button'
import { useCreateTicket } from '../hooks/useCreateTicket'

export function TicketsPage() {
  const { createTicket, loading, error } = useCreateTicket()

  const handleTestTicket = async () => {
    const result = await createTicket({
      title: 'Test Ticket',
      description: 'This is a test ticket to verify Supabase integration',
      priority: 'medium'
    })
    
    if (result) {
      console.log('Test ticket created successfully')
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Tickets</h1>
          <p className="text-muted-foreground">View and manage support tickets</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTestTicket} disabled={loading}>
            {loading ? 'Creating...' : 'Create Test Ticket'}
          </Button>
          <NewTicketDialog />
        </div>
      </div>
      
      {error && (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive">
          {error}
        </div>
      )}
      
      <TicketList />
    </div>
  )
} 