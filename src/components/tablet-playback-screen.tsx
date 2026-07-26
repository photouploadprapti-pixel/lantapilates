'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import { DrivePlaylistPlayer } from '@/components/drive-playlist-player'
import { NativePlaylistPlayer } from '@/components/native-playlist-player'
import { VideoTopBar } from '@/components/video-top-bar'
import { useLocalVideos } from '@/hooks/use-local-videos'
import { getDrivePreviewUrl, getDriveProxyStreamUrl } from '@/lib/drive-folder'
import { isTvApp } from '@/lib/is-tv-app'
import { titleFromFileName } from '@/lib/local-video-catalog'
import { getTabletPath, loadTabletSession } from '@/lib/tablet-session'
import { findMatchingVideoName } from '@/lib/video-name-match'
import { cn } from '@/lib/utils'
import type { LocalPlaylistVideo } from '@/types/local-playlist'
import type { TabletSlug } from '@/types/tablet'

const subscribeNoop = () => () => {}

type TabletPlaybackScreenProps = {
  slug: TabletSlug
}

/**
 * Full-screen playback for a tablet (Drive online or local offline playlist).
 * On TV: edge-to-edge video + remote-friendly controls (native shell bar).
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
  const [useDriveEmbedFallback, setUseDriveEmbedFallback] = useState(false)

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

    /**
     * Maps Escape / browser-back style keys toward the welcome screen.
     */
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

  useEffect(() => {
    setUseDriveEmbedFallback(false)
  }, [session?.userId, slug])

  const handleMpegTsFatalError = useCallback(() => {
    setUseDriveEmbedFallback(true)
  }, [])

  const isDriveSource = !isLocalSource

  const playlist = useMemo((): LocalPlaylistVideo[] => {
    if (!session?.videoFileNames?.length) {
      return []
    }

    if (session.videoSource === 'drive' || !session.videoSource) {
      return session.videoFileNames.map((fileId, index) => {
        const rawTitle = session.videoTitles?.[index] ?? fileId
        const displayTitle = titleFromFileName(rawTitle)
        const fileName = /\.(ts|mts|m2ts|mp4|m4v|webm|mkv|mov)$/i.test(rawTitle)
          ? rawTitle
          : `${rawTitle}.ts`

        // TV prefers proxied mpegts (fullscreen + real controls). Embed is fallback.
        const src =
          tvMode && !useDriveEmbedFallback
            ? getDriveProxyStreamUrl(fileId)
            : getDrivePreviewUrl(fileId)

        return {
          id: fileId,
          title: displayTitle,
          src,
          fileName,
        }
      })
    }

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
  }, [session, files, tvMode, useDriveEmbedFallback])

  if (!isClient || !session || session.slug !== slug) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-lanta-cream">
        <p className="text-sm tracking-wide text-lanta-charcoal/60 uppercase">Loading…</p>
      </div>
    )
  }

  const useEmbed = isDriveSource && (!tvMode || useDriveEmbedFallback)
  const isResolving = isLocalSource && (isLoading || !isReady)

  return (
    <div
      className={cn(
        'relative flex overflow-hidden bg-black',
        tvMode ? 'h-dvh flex-col' : 'h-dvh flex-col',
      )}
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
                  ? 'Assigned videos were not found in the selected folder.'
                  : 'Could not prepare Drive videos for playback.'}
            </p>
          </div>
        ) : useEmbed ? (
          <DrivePlaylistPlayer videos={playlist} className="h-full w-full" />
        ) : (
          <NativePlaylistPlayer
            videos={playlist}
            className="h-full w-full"
            hideChrome={tvMode}
            onMpegTsFatalError={
              tvMode && isDriveSource ? handleMpegTsFatalError : undefined
            }
          />
        )}
      </main>
    </div>
  )
}
