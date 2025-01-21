import { useState, useEffect } from 'react'
import { Button } from '@/ui/components/button'
import { TicketList } from '../components/TicketList'
import type { TicketStatus } from '../types/ticket.types'
import { useAuth } from '@/lib/auth/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/services/supabase'

/**
 * AgentDashboard page component
 * Displays a queue of tickets with filtering and real-time updates
 */
export function AgentDashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | 'all'>('all')
  const [selectedPriority, setSelectedPriority] = useState<'all' | 'high' | 'urgent'>('all')
  
  useEffect(() => {
    // Verify user is an agent or admin
    const checkRole = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single()

      if (!profile || !['agent', 'admin'].includes(profile.role)) {
        navigate('/dashboard')
      }
    }

    checkRole()
  }, [user, navigate])

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Agent Dashboard</h1>
          <p className="text-muted-foreground">Manage and process support tickets</p>
        </div>
        
        {/* Quick Filters */}
        <div className="flex items-center gap-6">
          {/* Status Filters */}
          <div>
            <span className="text-sm font-medium mr-3">Status:</span>
            <Button
              variant={selectedStatus === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedStatus('all')}
              size="sm"
            >
              All
            </Button>
            <Button
              variant={selectedStatus === 'open' ? 'default' : 'outline'}
              onClick={() => setSelectedStatus('open')}
              size="sm"
              className="ml-1"
            >
              Open
            </Button>
            <Button
              variant={selectedStatus === 'in_progress' ? 'default' : 'outline'}
              onClick={() => setSelectedStatus('in_progress')}
              size="sm"
              className="ml-1"
            >
              In Progress
            </Button>
          </div>
          
          {/* Priority Filters */}
          <div>
            <span className="text-sm font-medium mr-3">Priority:</span>
            <Button
              variant={selectedPriority === 'all' ? 'secondary' : 'ghost'}
              onClick={() => setSelectedPriority('all')}
              size="sm"
            >
              All
            </Button>
            <Button
              variant={selectedPriority === 'high' ? 'secondary' : 'ghost'}
              onClick={() => setSelectedPriority('high')}
              size="sm"
              className="ml-1 text-warning"
            >
              High
            </Button>
            <Button
              variant={selectedPriority === 'urgent' ? 'secondary' : 'ghost'}
              onClick={() => setSelectedPriority('urgent')}
              size="sm"
              className="ml-1 text-destructive"
            >
              Urgent
            </Button>
          </div>
        </div>
      </div>
      
      {/* Ticket List with filters */}
      <TicketList
        filters={{
          status: selectedStatus === 'all' ? undefined : selectedStatus,
          priority: selectedPriority === 'all' ? undefined : selectedPriority,
        }}
      />
    </div>
  )
} 