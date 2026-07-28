import type { SupabaseClient } from '@supabase/supabase-js'

import { getAdminSupabase } from './supabase-server'

const CATALOG_KEY = 'hosted_video_catalog'

export type HostedVideoFile = {
  id: string
  name: string
}

/** Fallback when settings are empty — keep in sync with src/lib/hosted-videos.ts */
export const DEFAULT_HOSTED_VIDEO_NAMES = [
  'Beginner-Arms & Back 39.mp4',
  'Beginner-Beginner Full Body 20.mp4',
  'Beginner-Beginner Full Body 38.mp4',
  'Beginner-Beginner Taster 1 - Foundations.mp4',
  'Beginner-Intro To Reformer Pilates With Emma.mp4',
  'Intermediate-Athletic 45.mp4',
  'Intermediate-Cardio Blast 32.mp4',
]

/**
 * @param names - File names
 */
export const toHostedCatalog = (names: string[]): HostedVideoFile[] =>
  names
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .map((name) => ({ id: name, name }))

/**
 * @param message - PostgREST error
 */
const isMissingTableError = (message: string | undefined): boolean => {
  if (!message) {
    return false
  }
  const lower = message.toLowerCase()
  return (
    lower.includes('schema cache')
    || lower.includes('does not exist')
    || lower.includes('could not find the table')
  )
}

/**
 * Loads the hosted MP4 catalog from app_settings (or defaults).
 */
export const getHostedVideoCatalog = async (): Promise<HostedVideoFile[]> => {
  const supabase = getAdminSupabase()
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', CATALOG_KEY)
    .maybeSingle()

  if (!error && data?.value?.trim()) {
    try {
      const parsed = JSON.parse(data.value) as unknown
      if (Array.isArray(parsed)) {
        const names = parsed
          .map((entry) => {
            if (typeof entry === 'string') {
              return entry
            }
            if (entry && typeof entry === 'object' && 'name' in entry) {
              return String((entry as { name: string }).name)
            }
            return ''
          })
          .filter(Boolean)
        if (names.length > 0) {
          return toHostedCatalog(names)
        }
      }
    } catch {
      // Fall through to defaults.
    }
  }

  if (error && !isMissingTableError(error.message)) {
    throw new Error(error.message)
  }

  return toHostedCatalog(DEFAULT_HOSTED_VIDEO_NAMES)
}

/**
 * Persists the hosted MP4 catalog.
 *
 * @param names - Exact file names on the hosting server
 */
export const setHostedVideoCatalog = async (
  names: string[],
): Promise<HostedVideoFile[]> => {
  const catalog = toHostedCatalog(names)
  if (catalog.length === 0) {
    throw new Error('Add at least one .mp4 file name')
  }

  const supabase = getAdminSupabase() as SupabaseClient
  const { error } = await supabase.from('app_settings').upsert({
    key: CATALOG_KEY,
    value: JSON.stringify(catalog.map((video) => video.name)),
    updated_at: new Date().toISOString(),
  })

  if (error && !isMissingTableError(error.message)) {
    throw new Error(error.message)
  }

  if (error && isMissingTableError(error.message)) {
    // Table missing — still return catalog for this request (in-memory only).
    return catalog
  }

  return catalog
}
