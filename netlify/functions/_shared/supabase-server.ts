import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import ws from 'ws'

const getEnv = (key: string): string => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`)
  }
  return value
}

/**
 * Server-side Supabase client for Netlify functions (service role, no session).
 * Uses the ws transport so Node.js < 22 works in serverless runtimes.
 */
export const getAdminSupabase = (): SupabaseClient => {
  return createClient(
    getEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: ws },
    },
  )
}
