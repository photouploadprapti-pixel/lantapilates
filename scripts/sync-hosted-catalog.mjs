/**
 * Syncs the full hosted MP4 catalog into Supabase and deletes legacy Drive rows.
 * Usage: node --env-file=.env.local scripts/sync-hosted-catalog.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const names = JSON.parse(
  readFileSync(join(root, 'shared/hosted-video-names.json'), 'utf8'),
)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const isHosted = (name) => /\.(mp4|m4v|webm|mov)$/i.test(String(name ?? '').trim())

const { error: upsertError } = await supabase.from('app_settings').upsert({
  key: 'hosted_video_catalog',
  value: JSON.stringify(names),
  updated_at: new Date().toISOString(),
})

if (upsertError) {
  console.error('Catalog upsert failed:', upsertError.message)
  process.exit(1)
}

console.log(`Saved hosted catalog: ${names.length} files`)

const { data: rows, error: listError } = await supabase
  .from('user_videos')
  .select('id, youtube_video_id')

if (listError) {
  console.error('List user_videos failed:', listError.message)
  process.exit(1)
}

const legacyIds = (rows ?? [])
  .filter((row) => !isHosted(row.youtube_video_id))
  .map((row) => row.id)

if (legacyIds.length === 0) {
  console.log('No legacy Google Drive assignments found')
  process.exit(0)
}

const { error: deleteError } = await supabase
  .from('user_videos')
  .delete()
  .in('id', legacyIds)

if (deleteError) {
  console.error('Purge failed:', deleteError.message)
  process.exit(1)
}

console.log(`Deleted ${legacyIds.length} legacy Google Drive assignment(s)`)
