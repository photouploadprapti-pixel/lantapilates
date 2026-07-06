'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useSyncExternalStore } from 'react'

import { PlaybackPlayer } from '@/components/playback-player'
import { VideoTopBar } from '@/components/video-top-bar'
import { loadNameSession } from '@/lib/name-session'

const subscribeNoop = () => () => {}

/**
 * Full-screen workout playback with branded top bar and embedded video player.
 */
export const VideoPlaybackScreen = () => {
  const router = useRouter()
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const userName = isClient ? loadNameSession() : null

  useEffect(() => {
    if (!isClient) return
    if (!userName) {
      router.replace('/')
    }
  }, [isClient, userName, router])

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
        <PlaybackPlayer className="h-full w-full" />
      </main>
      <VideoTopBar
        userName={userName}
        className="absolute inset-x-0 top-0 z-30"
      />
    </div>
  )
}
