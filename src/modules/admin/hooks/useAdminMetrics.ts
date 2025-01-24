import { useState, useEffect } from 'react'
import { supabase } from '@/services/supabase'

interface DatabaseSize {
  table_name: string
  row_count: number
  total_size_bytes: number
}

interface QueryMetric {
  query_type: string
  avg_exec_time: number
  calls: number
  rows_per_call: number
}

interface TicketResolutionMetric {
  status: string
  avg_resolution_time_minutes: number
  ticket_count: number
}

interface AgentPerformanceMetric {
  agent_id: string
  agent_name: string
  tickets_resolved: number
  avg_resolution_time_minutes: number
  satisfaction_score: number
}

interface AdminMetrics {
  databaseSize: DatabaseSize[]
  queryMetrics: QueryMetric[]
  ticketResolutionMetrics: TicketResolutionMetric[]
  agentPerformanceMetrics: AgentPerformanceMetric[]
  loading: boolean
  error: string | null
}

export function useAdminMetrics() {
  const [metrics, setMetrics] = useState<AdminMetrics>({
    databaseSize: [],
    queryMetrics: [],
    ticketResolutionMetrics: [],
    agentPerformanceMetrics: [],
    loading: true,
    error: null
  })

  const fetchMetrics = async () => {
    try {
      // Fetch all metrics in parallel
      const [
        { data: dbSize, error: dbError },
        { data: queryMetrics, error: queryError },
        { data: resolutionMetrics, error: resolutionError },
        { data: agentMetrics, error: agentError }
      ] = await Promise.all([
        supabase.rpc('get_database_size'),
        supabase.rpc('get_query_metrics'),
        supabase.rpc('get_ticket_resolution_metrics'),
        supabase.rpc('get_agent_performance_metrics')
      ])

      // Check for errors
      if (dbError) throw dbError
      if (queryError) throw queryError
      if (resolutionError) throw resolutionError
      if (agentError) throw agentError

      setMetrics({
        databaseSize: dbSize || [],
        queryMetrics: queryMetrics || [],
        ticketResolutionMetrics: resolutionMetrics || [],
        agentPerformanceMetrics: agentMetrics || [],
        loading: false,
        error: null
      })
    } catch (error) {
      console.error('Error fetching admin metrics:', error)
      setMetrics(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load admin metrics'
      }))
    }
  }

  useEffect(() => {
    fetchMetrics()

    // Set up interval to refresh metrics every 5 minutes
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  // Helper function to format bytes to human-readable size
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  // Helper function to format minutes to human-readable duration
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`
    } else if (minutes < 1440) {
      return `${Math.round(minutes / 60)}h`
    } else {
      return `${Math.round(minutes / 1440)}d`
    }
  }

  return {
    ...metrics,
    formatBytes,
    formatDuration,
    refetch: fetchMetrics
  }
} 