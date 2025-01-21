import { supabase } from './supabase'

export async function testDatabase() {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    console.log('Current user:', user)

    // Get current profile
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user?.id)
      .single()
    console.log('Current profile:', currentProfile)

    // Get all profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
    console.log('All profiles:', profiles)

    // Get table info
    const { data: tableInfo } = await supabase
      .rpc('get_table_info', { table_name: 'profiles' })
    console.log('Table info:', tableInfo)

    return {
      user,
      currentProfile,
      profiles,
      tableInfo
    }
  } catch (error) {
    console.error('Test failed:', error)
    throw error
  }
} 