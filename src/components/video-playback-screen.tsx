'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useSyncExternalStore } from 'react'

import { PlaybackPlayer } from '@/components/playback-player'
import { useLocalVideos } from '@/hooks/use-local-videos'
import { titleFromFileName } from '@/lib/local-video-catalog'
import { loadNameSession } from '@/lib/name-session'
import type { LocalPlaylistVideo } from '@/types/local-playlist'

const subscribeNoop = () => () => {}

/**
 * Full-screen workout playback with local folder player and transport bar.
 */
export const VideoPlaybackScreen = () => {
  const router = useRouter()
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const userName = isClient ? loadNameSession() : null
  const { files, isLoading, isReady } = useLocalVideos()

  useEffect(() => {
    if (!isClient) return
    if (!userName) {
      router.replace('/')
    }
  }, [isClient, userName, router])

  const playlist = useMemo((): LocalPlaylistVideo[] =>
    files
      .filter((file) => Boolean(file.playbackUrl))
      .map((file) => ({
        id: file.id,
        title: titleFromFileName(file.name),
        src: file.playbackUrl,
        fileName: file.name,
      })),
  [files])

  if (!isClient || !userName) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-lanta-cream">
        <p className="text-sm tracking-wide text-lanta-charcoal/60 uppercase">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-black">
      <PlaybackPlayer
        videos={playlist}
        isResolving={isLoading || !isReady}
        emptyMessage="Select a video folder with workout files to begin playback."
        className="min-h-0 flex-1"
        onBack={() => router.replace('/')}
      />
    </div>
  )
}
