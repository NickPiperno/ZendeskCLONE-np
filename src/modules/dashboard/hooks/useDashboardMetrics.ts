import { useState, useEffect } from 'react'
import { supabase } from '@/services/supabase'
import { TicketService } from '@/services/tickets'

interface DashboardMetrics {
  totalTickets: number
  openTickets: number
  avgResponseTime: string
  loading: boolean
  error: string | null
}

export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalTickets: 0,
    openTickets: 0,
    avgResponseTime: '--',
    loading: true,
    error: null
  })

  const fetchMetrics = async () => {
    try {
      // Get total tickets
      const { data: totalTickets } = await TicketService.getTickets()
      
      // Get open tickets
      const { data: openTickets } = await TicketService.getTickets({ status: 'open' })
      
      // Get average response time from Supabase function
      const { data: avgResponse, error: avgError } = await supabase
        .rpc('calculate_avg_response_time')

      if (avgError) throw avgError

      setMetrics({
        totalTickets: totalTickets?.length || 0,
        openTickets: openTickets?.length || 0,
        avgResponseTime: formatResponseTime(avgResponse || 0),
        loading: false,
        error: null
      })
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error)
      setMetrics(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load dashboard metrics'
      }))
    }
  }

  // Helper function to format response time
  const formatResponseTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`
    } else if (minutes < 1440) { // Less than 24 hours
      return `${Math.round(minutes / 60)}h`
    } else {
      return `${Math.round(minutes / 1440)}d`
    }
  }

  useEffect(() => {
    fetchMetrics()

    // Subscribe to ticket changes
    const channel = supabase
      .channel('dashboard-metrics')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        () => {
          // Refetch metrics when tickets change
          fetchMetrics()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [])

  return metrics
} 