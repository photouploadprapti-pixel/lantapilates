import type { SupabaseClient } from '@supabase/supabase-js'

import hostedVideoNames from '../../../shared/hosted-video-names.json'
import { getAdminSupabase } from './supabase-server'

const CATALOG_KEY = 'hosted_video_catalog'

export type HostedVideoFile = {
  id: string
  name: string
}

/** Fallback when settings are empty — keep in sync with shared/hosted-video-names.json */
export const DEFAULT_HOSTED_VIDEO_NAMES: string[] = hostedVideoNames as string[]

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

/**
 * Deletes legacy Google Drive assignments (rows that are not hosted video file names).
 */
export const purgeLegacyDriveAssignments = async (): Promise<{ deleted: number }> => {
  const supabase = getAdminSupabase()
  const { data, error } = await supabase
    .from('user_videos')
    .select('id, youtube_video_id')

  if (error) {
    throw new Error(error.message)
  }

  const legacyIds = (data ?? [])
    .filter((row) => {
      const name = String(row.youtube_video_id ?? '').trim().toLowerCase()
      return !(
        name.endsWith('.mp4')
        || name.endsWith('.m4v')
        || name.endsWith('.webm')
        || name.endsWith('.mov')
      )
    })
    .map((row) => row.id as string)

  if (legacyIds.length === 0) {
    return { deleted: 0 }
  }

  const { error: deleteError } = await supabase
    .from('user_videos')
    .delete()
    .in('id', legacyIds)

  if (deleteError) {
    throw new Error(deleteError.message)
  }

  return { deleted: legacyIds.length }
}
