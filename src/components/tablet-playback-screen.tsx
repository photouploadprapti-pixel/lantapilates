'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import { NativePlaylistPlayer } from '@/components/native-playlist-player'
import { useLocalVideos } from '@/hooks/use-local-videos'
import { getHostedVideoUrl } from '@/lib/hosted-videos'
import { preloadHostedPlaylist } from '@/lib/hosted-video-preload'
import { isTvApp } from '@/lib/is-tv-app'
import { titleFromFileName } from '@/lib/local-video-catalog'
import {
  buildOfflinePlaylist,
  moveOfflinePlaylistItem,
} from '@/lib/offline-playlist'
import {
  getTabletPath,
  loadTabletSession,
  saveTabletSession,
} from '@/lib/tablet-session'
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
  const [playlistVersion, setPlaylistVersion] = useState(0)

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
    if (isLocalSource) {
      return buildOfflinePlaylist(files)
    }

    if (!session?.videoFileNames?.length) {
      return []
    }

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
  }, [session, files, isLocalSource, playlistVersion])

  // Warm only the first clip on the dedicated play route (fallback / non-inline path).
  useEffect(() => {
    if (isLocalSource || playlist.length === 0) {
      return
    }
    preloadHostedPlaylist(
      playlist.map((video) => video.src),
      1,
    )
  }, [playlist, isLocalSource])

  /**
   * Moves the playing offline clip earlier/later and keeps the session in sync.
   *
   * @param activeIndex - Current playlist index
   * @param direction - -1 earlier, +1 later
   */
  const handleMoveInPlaylist = (activeIndex: number, direction: -1 | 1) => {
    if (!isLocalSource) {
      return
    }
    const current = playlist[activeIndex]
    if (!current?.fileName) {
      return
    }

    const nextOrder = moveOfflinePlaylistItem(current.fileName, direction)
    const currentSession = loadTabletSession()
    if (currentSession) {
      saveTabletSession({
        ...currentSession,
        videoFileNames: nextOrder,
        videoTitles: nextOrder.map((name) => {
          const match = playlist.find((video) => video.fileName === name)
          return match?.title ?? name
        }),
        startIndex: Math.max(0, Math.min(activeIndex + direction, nextOrder.length - 1)),
      })
    }
    setPlaylistVersion((value) => value + 1)
  }

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
      className="relative flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-black"
      data-tv-playback={tvMode ? 'true' : undefined}
    >
      {isResolving ? (
        <div className="flex h-full w-full items-center justify-center bg-black">
          <p className="text-sm tracking-wide text-white/70 uppercase">Loading videos…</p>
        </div>
      ) : playlist.length === 0 ? (
        <div className="flex h-full w-full items-center justify-center bg-black px-6">
          <p className="max-w-md text-center text-sm text-white/70">
            {isLocalSource
              ? 'No videos found in the LantaPilates folder.'
              : session.videoFileNames.length === 0
                ? 'No videos assigned to this user yet.'
                : 'Could not prepare hosted videos for playback.'}
          </p>
        </div>
      ) : (
        <NativePlaylistPlayer
          videos={playlist}
          className="min-h-0 flex-1"
          hideChrome={tvMode}
          allowReorder={isLocalSource}
          startIndex={session.startIndex ?? 0}
          onMoveInPlaylist={isLocalSource ? handleMoveInPlaylist : undefined}
          onBack={() => {
            router.replace(isLocalSource ? '/' : getTabletPath(slug))
          }}
        />
      )}
    </div>
  )
}
