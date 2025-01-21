import { supabase } from './supabase'

export async function testDatabase() {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    console.log('Current user:', user)

    // Get current profile
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user?.id)
      .single()
    console.log('Current profile:', currentProfile)

    // Make user admin if not already
    let roleUpdated = false
    if (currentProfile?.role !== 'admin') {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', user?.id)
      
      if (updateError) throw updateError
      roleUpdated = true
    }

    // Get all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
    console.log('All profiles:', profiles)

    // Get table info with detailed error logging
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_info', { table_name: 'profiles' })
    console.log('Table info call result:', { data: tableInfo, error: tableError })

    if (tableError) {
      console.error('Table info error details:', {
        code: tableError.code,
        message: tableError.message,
        details: tableError.details,
        hint: tableError.hint
      })
    }

    return {
      user,
      currentProfile,
      profiles,
      tableInfo,
      roleUpdated,
      error: tableError
    }
  } catch (error) {
    console.error('Test database error:', error)
    return {
      user: null,
      currentProfile: null,
      profiles: null,
      tableInfo: null,
      roleUpdated: false,
      error
    }
  }
} 