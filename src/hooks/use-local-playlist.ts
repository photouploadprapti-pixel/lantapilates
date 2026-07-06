'use client'

import { useEffect, useState } from 'react'

import { fetchLocalPlaylistManifest } from '@/lib/local-playlist-manifest'
import type { LocalPlaylistManifest } from '@/types/local-playlist'

type LocalPlaylistState = {
  manifest: LocalPlaylistManifest | null
  isLoading: boolean
  useNativePlayback: boolean
}

/**
 * Loads the local reformer playlist manifest for native HTML5 playback.
 */
export const useLocalPlaylist = (): LocalPlaylistState => {
  const [manifest, setManifest] = useState<LocalPlaylistManifest | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const result = await fetchLocalPlaylistManifest()
      if (!cancelled) {
        setManifest(result)
        setIsLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  return {
    manifest,
    isLoading,
    useNativePlayback: manifest !== null && manifest.videos.length > 0,
  }
}
