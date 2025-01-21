import { supabase } from './supabase'

/**
 * Tests Supabase Row Level Security policies by attempting various operations
 * @returns Object containing test results
 */
export async function testRLSPolicies() {
  const results = {
    unauthenticated: {
      canRead: false,
      canWrite: false,
      error: null as string | null
    },
    authenticated: {
      canRead: false,
      canWrite: false,
      error: null as string | null
    }
  }

  try {
    // Test unauthenticated access
    const { error: readError } = await supabase
      .from('tickets')
      .select('*')
      .limit(1)

    if (readError) {
      results.unauthenticated.error = readError.message
    } else {
      results.unauthenticated.canRead = true
    }

    const { error: writeError } = await supabase
      .from('tickets')
      .insert([
        {
          title: 'Test Ticket',
          description: 'Testing RLS',
          user_id: 'test-user'
        }
      ])

    if (writeError) {
      results.unauthenticated.error = writeError.message
    } else {
      results.unauthenticated.canWrite = true
    }

    // Test authenticated access would go here after we set up auth
    // We'll need to implement this after setting up authentication

  } catch (error) {
    console.error('Error testing RLS:', error)
  }

  return results
} 