import { Button } from '../../../ui/components/button'

export function TicketsPage() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Tickets</h1>
        <Button>New Ticket</Button>
      </div>
      
      <div className="rounded-lg border">
        <div className="p-4 border-b bg-muted/50">
          <p className="text-sm text-muted-foreground">No tickets found</p>
        </div>
        <div className="p-4">
          <div className="flex flex-col items-center justify-center space-y-2 py-8 text-center">
            <p className="text-muted-foreground">No tickets have been created yet</p>
            <Button variant="outline" size="sm">Create your first ticket</Button>
          </div>
        </div>
      </div>
    </div>
  )
} 