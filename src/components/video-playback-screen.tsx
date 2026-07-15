'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useSyncExternalStore } from 'react'

import { PlaybackPlayer } from '@/components/playback-player'
import { VideoTopBar } from '@/components/video-top-bar'
import { useLocalVideos } from '@/hooks/use-local-videos'
import { titleFromFileName } from '@/lib/local-video-catalog'
import { loadNameSession } from '@/lib/name-session'
import type { LocalPlaylistVideo } from '@/types/local-playlist'

const subscribeNoop = () => () => {}

/**
 * Full-screen workout playback with branded top bar and local folder player.
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
    <div className="relative h-dvh overflow-hidden bg-black">
      <main className="absolute inset-0">
        <PlaybackPlayer
          videos={playlist}
          isResolving={isLoading || !isReady}
          emptyMessage="Select a video folder with workout files to begin playback."
          className="h-full w-full"
        />
      </main>
      <VideoTopBar
        userName={userName}
        className="absolute inset-x-0 top-0 z-30"
      />
    </div>
  )
}
