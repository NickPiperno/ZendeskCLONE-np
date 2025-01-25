import { QueryClient } from '@tanstack/react-query'

// Create a client
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Reasonable defaults for our thread system
            gcTime: 1000 * 60 * 5, // Cache persists for 5 minutes
            staleTime: 1000 * 60, // Data becomes stale after 1 minute
            refetchOnWindowFocus: true, // Refetch when window regains focus
            refetchOnReconnect: true, // Refetch on reconnection
            retry: 3, // Retry failed requests 3 times
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
        },
        mutations: {
            retry: 2, // Retry failed mutations twice
            retryDelay: 1000, // 1 second delay between retries
        },
    },
})

// Query key factory for thread-related queries
export const threadKeys = {
    all: ['threads'] as const,
    lists: () => [...threadKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...threadKeys.lists(), filters] as const,
    details: () => [...threadKeys.all, 'detail'] as const,
    detail: (id: string) => [...threadKeys.details(), id] as const,
}

// Error boundary component for React Query
export const queryErrorHandler = (error: unknown): string => {
    // Log to error reporting service
    console.error('React Query Error:', error)
    // You can add more sophisticated error handling here
    return error instanceof Error ? error.message : 'An error occurred'
} 