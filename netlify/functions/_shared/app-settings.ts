import type { SupabaseClient } from '@supabase/supabase-js'

import { getAdminSupabase } from './supabase-server'

export const DEFAULT_DRIVE_FOLDER_URL =
  'https://drive.google.com/drive/folders/1wCKXxGERf3rZmvwrpBlJqSY63S9cJoBh?usp=sharing'

const SETTINGS_BUCKET = 'app-settings'
const DRIVE_FOLDER_OBJECT = 'drive_folder_url.txt'
const DRIVE_FOLDER_KEY = 'drive_folder_url'

/**
 * Returns true when PostgREST reports a missing table / stale schema cache.
 *
 * @param message - Supabase / PostgREST error message
 */
const isMissingTableError = (message: string | undefined): boolean => {
  if (!message) {
    return false
  }

  const lower = message.toLowerCase()
  return (
    lower.includes('schema cache') ||
    lower.includes('does not exist') ||
    lower.includes('could not find the table')
  )
}

/**
 * Ensures the private settings storage bucket exists (fallback when SQL table is absent).
 *
 * @param supabase - Service-role Supabase client
 */
const ensureSettingsBucket = async (supabase: SupabaseClient): Promise<void> => {
  const { data: buckets, error } = await supabase.storage.listBuckets()
  if (error) {
    throw new Error(error.message)
  }

  if (buckets?.some((bucket) => bucket.name === SETTINGS_BUCKET)) {
    return
  }

  const { error: createError } = await supabase.storage.createBucket(SETTINGS_BUCKET, {
    public: false,
  })

  if (createError && !createError.message.toLowerCase().includes('already exists')) {
    throw new Error(createError.message)
  }
}

/**
 * Reads the Drive folder URL from Storage when `app_settings` is unavailable.
 *
 * @param supabase - Service-role Supabase client
 */
const readDriveFolderUrlFromStorage = async (
  supabase: SupabaseClient,
): Promise<string | null> => {
  await ensureSettingsBucket(supabase)

  const { data, error } = await supabase.storage
    .from(SETTINGS_BUCKET)
    .download(DRIVE_FOLDER_OBJECT)

  if (error || !data) {
    return null
  }

  const text = (await data.text()).trim()
  return text || null
}

/**
 * Writes the Drive folder URL to Storage (works without `app_settings` table).
 *
 * @param supabase - Service-role Supabase client
 * @param url - Drive folder share URL
 */
const writeDriveFolderUrlToStorage = async (
  supabase: SupabaseClient,
  url: string,
): Promise<void> => {
  await ensureSettingsBucket(supabase)

  const { error } = await supabase.storage
    .from(SETTINGS_BUCKET)
    .upload(DRIVE_FOLDER_OBJECT, url, {
      contentType: 'text/plain; charset=utf-8',
      upsert: true,
    })

  if (error) {
    throw new Error(error.message)
  }
}

/**
 * Loads the configured Google Drive folder URL.
 * Prefers `app_settings`, falls back to Storage, then the default share URL.
 */
export const getDriveFolderUrl = async (): Promise<string> => {
  const supabase = getAdminSupabase()

  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', DRIVE_FOLDER_KEY)
    .maybeSingle()

  if (!error && data?.value?.trim()) {
    return data.value.trim()
  }

  if (error && !isMissingTableError(error.message)) {
    throw new Error(error.message)
  }

  const fromStorage = await readDriveFolderUrlFromStorage(supabase)
  if (fromStorage) {
    return fromStorage
  }

  return DEFAULT_DRIVE_FOLDER_URL
}

/**
 * Persists the Google Drive folder URL.
 * Uses `app_settings` when present; otherwise Storage.
 *
 * @param url - Drive folder share URL
 */
export const setDriveFolderUrl = async (url: string): Promise<string> => {
  const trimmed = url.trim()
  if (!trimmed) {
    throw new Error('Drive folder URL is required')
  }

  const supabase = getAdminSupabase()
  const { error } = await supabase.from('app_settings').upsert({
    key: DRIVE_FOLDER_KEY,
    value: trimmed,
    updated_at: new Date().toISOString(),
  })

  if (!error) {
    // Keep Storage in sync so either backend path stays consistent.
    try {
      await writeDriveFolderUrlToStorage(supabase, trimmed)
    } catch {
      // Table write succeeded; Storage sync is best-effort.
    }
    return trimmed
  }

  if (!isMissingTableError(error.message)) {
    throw new Error(error.message)
  }

  await writeDriveFolderUrlToStorage(supabase, trimmed)
  return trimmed
}
