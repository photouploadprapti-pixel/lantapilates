'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useSyncExternalStore } from 'react'

import { PlaybackPlayer } from '@/components/playback-player'
import { VideoTopBar } from '@/components/video-top-bar'
import { getTabletPath, loadTabletSession } from '@/lib/tablet-session'
import { cn } from '@/lib/utils'
import type { TabletSlug } from '@/types/tablet'

const subscribeNoop = () => () => {}

type TabletPlaybackScreenProps = {
  slug: TabletSlug
}

/**
 * Full-screen playback for a tablet using the assigned user video list.
 * @param slug - Tablet route slug
 */
export const TabletPlaybackScreen = ({ slug }: TabletPlaybackScreenProps) => {
  const router = useRouter()
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const session = isClient ? loadTabletSession() : null

  useEffect(() => {
    if (!isClient) {
      return
    }

    if (!session || session.slug !== slug) {
      router.replace(getTabletPath(slug))
    }
  }, [isClient, session, slug, router])

  if (!isClient || !session || session.slug !== slug) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-lanta-cream">
        <p className="text-sm tracking-wide text-lanta-charcoal/60 uppercase">Loading…</p>
      </div>
    )
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-black">
      <main className="absolute inset-0">
        <PlaybackPlayer videoIds={session.videoIds} className="h-full w-full" />
      </main>
      <VideoTopBar
        userName={session.userName}
        className={cn('absolute inset-x-0 top-0 z-30')}
      />
    </div>
  )
}
