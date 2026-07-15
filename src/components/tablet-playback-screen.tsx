'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useSyncExternalStore } from 'react'

import { PlaybackPlayer } from '@/components/playback-player'
import { VideoTopBar } from '@/components/video-top-bar'
import { useLocalVideos } from '@/hooks/use-local-videos'
import { titleFromFileName } from '@/lib/local-video-catalog'
import { getTabletPath, loadTabletSession } from '@/lib/tablet-session'
import { findMatchingVideoName } from '@/lib/video-name-match'
import type { LocalPlaylistVideo } from '@/types/local-playlist'
import type { TabletSlug } from '@/types/tablet'

const subscribeNoop = () => () => {}

type TabletPlaybackScreenProps = {
  slug: TabletSlug
}

/**
 * Full-screen local playback for a tablet using assigned file names.
 * @param slug - Tablet route slug
 */
export const TabletPlaybackScreen = ({ slug }: TabletPlaybackScreenProps) => {
  const router = useRouter()
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const session = isClient ? loadTabletSession() : null
  const { isReady, hasFolder, files, isLoading } = useLocalVideos()

  useEffect(() => {
    if (!isClient) {
      return
    }

    if (!session || session.slug !== slug || (isReady && !hasFolder)) {
      router.replace(getTabletPath(slug))
    }
  }, [isClient, session, slug, router, isReady, hasFolder])

  const playlist = useMemo((): LocalPlaylistVideo[] => {
    if (!session?.videoFileNames?.length || files.length === 0) {
      return []
    }

    const localNames = files.map((file) => file.name)

    return session.videoFileNames.flatMap((assignedName) => {
      const matchedName = findMatchingVideoName(assignedName, localNames)
      if (!matchedName) {
        return []
      }

      const file = files.find((entry) => entry.name === matchedName)
      if (!file?.playbackUrl) {
        return []
      }

      return [
        {
          id: file.id,
          title: titleFromFileName(file.name),
          src: file.playbackUrl,
          fileName: file.name,
        },
      ]
    })
  }, [session, files])

  if (!isClient || !session || session.slug !== slug) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-lanta-cream">
        <p className="text-sm tracking-wide text-lanta-charcoal/60 uppercase">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-black">
      <VideoTopBar userName={session.userName} />
      <main className="min-h-0 flex-1">
        <PlaybackPlayer
          videos={playlist}
          isResolving={isLoading || !isReady}
          emptyMessage={
            session.videoFileNames.length === 0
              ? 'No videos assigned to this user yet.'
              : 'Assigned videos were not found in the selected folder. File names must match.'
          }
          className="h-full w-full"
        />
      </main>
    </div>
  )
}
