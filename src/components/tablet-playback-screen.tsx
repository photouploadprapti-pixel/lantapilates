'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useSyncExternalStore } from 'react'

import { NativePlaylistPlayer } from '@/components/native-playlist-player'
import { VideoTopBar } from '@/components/video-top-bar'
import { useLocalVideos } from '@/hooks/use-local-videos'
import { getHostedVideoUrl } from '@/lib/hosted-videos'
import { isTvApp } from '@/lib/is-tv-app'
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
 * Full-screen playback for hosted MP4s (online) or local offline files.
 * Uses HTML5 video for fast start — no Google Drive iframe.
 *
 * @param slug - Tablet route slug
 */
export const TabletPlaybackScreen = ({ slug }: TabletPlaybackScreenProps) => {
  const router = useRouter()
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const session = isClient ? loadTabletSession() : null
  const { isReady, hasFolder, files, isLoading } = useLocalVideos()
  const isLocalSource = session?.videoSource === 'local'
  const tvMode = isClient && isTvApp()

  useEffect(() => {
    if (!isClient) {
      return
    }

    if (!session || session.slug !== slug) {
      router.replace(getTabletPath(slug))
      return
    }

    if (isLocalSource && isReady && !hasFolder) {
      router.replace('/')
    }
  }, [isClient, session, slug, router, isLocalSource, isReady, hasFolder])

  useEffect(() => {
    if (!tvMode || !isClient) {
      return
    }

    document.body.classList.add('tv-playback')

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.key !== 'BrowserBack') {
        return
      }

      event.preventDefault()
      router.replace(getTabletPath(slug))
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.classList.remove('tv-playback')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [tvMode, isClient, router, slug])

  const playlist = useMemo((): LocalPlaylistVideo[] => {
    if (!session?.videoFileNames?.length) {
      return []
    }

    if (isLocalSource) {
      if (files.length === 0) {
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
    }

    // Online / hosted MP4s (also treat legacy 'drive' sessions as hosted file names).
    return session.videoFileNames.map((fileName, index) => {
      const rawTitle = session.videoTitles?.[index] ?? fileName
      const displayTitle = titleFromFileName(rawTitle)
      const safeName = /\.(mp4|m4v|webm|mov|ts|mts|m2ts)$/i.test(fileName)
        ? fileName
        : `${fileName}.mp4`

      return {
        id: fileName,
        title: displayTitle,
        src: getHostedVideoUrl(safeName),
        fileName: safeName,
      }
    })
  }, [session, files, isLocalSource])

  if (!isClient || !session || session.slug !== slug) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-lanta-cream">
        <p className="text-sm tracking-wide text-lanta-charcoal/60 uppercase">Loading…</p>
      </div>
    )
  }

  const isResolving = isLocalSource && (isLoading || !isReady)

  return (
    <div
      className="relative flex h-dvh flex-col overflow-hidden bg-black"
      data-tv-playback={tvMode ? 'true' : undefined}
    >
      {!tvMode ? <VideoTopBar userName={session.userName} /> : null}

      <main className="relative min-h-0 flex-1 bg-black">
        {isResolving ? (
          <div className="flex h-full w-full items-center justify-center bg-black">
            <p className="text-sm tracking-wide text-white/70 uppercase">Loading videos…</p>
          </div>
        ) : playlist.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center bg-black px-6">
            <p className="max-w-md text-center text-sm text-white/70">
              {session.videoFileNames.length === 0
                ? 'No videos assigned to this user yet.'
                : isLocalSource
                  ? 'No videos found in the LantaPilates folder.'
                  : 'Could not prepare hosted videos for playback.'}
            </p>
          </div>
        ) : (
          <NativePlaylistPlayer
            videos={playlist}
            className="h-full w-full"
            hideChrome={tvMode}
            onBack={() => {
              router.replace(isLocalSource ? '/' : getTabletPath(slug))
            }}
          />
        )}
      </main>
    </div>
  )
}
