import type { LocalPlaylistManifest, LocalPlaylistVideo } from '@/types/local-playlist'

import { LANTA_REFORMER_PLAYLIST_ID } from '@/lib/youtube-playlist'

const MANIFEST_PATH = '/videos/reformer/manifest.json'

const isLocalPlaylistVideo = (value: unknown): value is LocalPlaylistVideo => {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string'
    && typeof record.title === 'string'
    && typeof record.src === 'string'
  )
}

const isLocalPlaylistManifest = (value: unknown): value is LocalPlaylistManifest => {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.playlistId === 'string'
    && Array.isArray(record.videos)
    && record.videos.every(isLocalPlaylistVideo)
  )
}

/**
 * Fetches the on-device reformer playlist manifest when videos have been synced.
 */
export const fetchLocalPlaylistManifest = async (): Promise<LocalPlaylistManifest | null> => {
  try {
    const response = await fetch(MANIFEST_PATH, { cache: 'no-store' })
    if (!response.ok) return null

    const data: unknown = await response.json()
    if (!isLocalPlaylistManifest(data) || data.videos.length === 0) return null

    return data
  } catch {
    return null
  }
}

/** Empty manifest placeholder written by the sync script before first download */
export const EMPTY_LOCAL_PLAYLIST: LocalPlaylistManifest = {
  playlistId: LANTA_REFORMER_PLAYLIST_ID,
  videos: [],
}
