import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

/**
 * Browser Supabase client for public tablet reads.
 */
export const createBrowserSupabaseClient = (): SupabaseClient => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}

/**
 * Shared singleton for client components.
 */
export const getSupabaseClient = (): SupabaseClient => {
  if (!browserClient) {
    browserClient = createBrowserSupabaseClient()
  }
  return browserClient
}

