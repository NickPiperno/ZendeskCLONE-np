import { Button } from '@/ui/components/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/tabs'
import { ChevronLeft } from 'lucide-react'
import type { CustomerTicket } from '../types/ticket.types'
import { TicketCard } from './TicketCard'
import { CustomerTicketTimeline } from './CustomerTicketTimeline'
import { ThreadView } from './thread/ThreadView'

interface CustomerTicketDetailProps {
  ticket: CustomerTicket
  onBack: () => void
}

export function CustomerTicketDetail({ ticket, onBack }: CustomerTicketDetailProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onBack}
          className="mt-1"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div className="flex-1">
          <TicketCard ticket={ticket} onSelect={() => {}} />
        </div>
      </div>

      <Tabs defaultValue="threads" className="space-y-4">
        <TabsList>
          <TabsTrigger value="threads">Threads</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="threads" className="space-y-6">
          <ThreadView ticketId={ticket.id} />
        </TabsContent>

        <TabsContent value="timeline">
          <CustomerTicketTimeline ticketId={ticket.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
} 