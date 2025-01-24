import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { Navigate } from 'react-router-dom'
import { NewTicketDialog } from '../components/NewTicketDialog'
import { customerTicketService } from '@/services/customer-tickets'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/tabs'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/ui/components/skeleton'
import { CustomerTicketList } from '../components/CustomerTicketList'
import { CustomerTicketTimeline } from '../components/CustomerTicketTimeline'
import type { TicketSummary } from '../types/ticket.types'

export function CustomerTicketsPage() {
  const { profile } = useAuth()
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('list')

  // Redirect admin/agent users to admin tickets page
  if (profile?.role === 'admin' || profile?.role === 'agent') {
    return <Navigate to="/tickets" replace />
  }

  // Fetch ticket summary
  const { data: ticketSummary, isLoading: summaryLoading } = useQuery<TicketSummary[]>({
    queryKey: ['ticketSummary'],
    queryFn: () => customerTicketService.getTicketSummary()
  })

  const handleTicketSelect = (ticketId: string) => {
    setSelectedTicketId(ticketId)
    setActiveTab('timeline')
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">My Support Tickets</h1>
          <p className="text-muted-foreground">View and manage your support requests</p>
        </div>
        <NewTicketDialog />
      </div>

      {/* Ticket Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {summaryLoading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          ticketSummary?.map((summary: TicketSummary) => (
            <Card key={summary.status}>
              <CardHeader>
                <CardTitle className="capitalize">{summary.status}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.count}</div>
                <p className="text-xs text-muted-foreground">
                  Last updated: {new Date(summary.last_update).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Tickets View */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="timeline">Timeline View</TabsTrigger>
        </TabsList>
        
        <TabsContent value="list" className="space-y-4">
          <CustomerTicketList onTicketSelect={handleTicketSelect} />
        </TabsContent>

        <TabsContent value="timeline">
          {selectedTicketId ? (
            <CustomerTicketTimeline ticketId={selectedTicketId} />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Select a ticket to view its timeline
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
} 