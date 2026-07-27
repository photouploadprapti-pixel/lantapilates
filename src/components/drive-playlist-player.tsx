'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getDrivePreviewUrl } from '@/lib/drive-folder'
import { isTvApp } from '@/lib/is-tv-app'
import { cn } from '@/lib/utils'
import type { LocalPlaylistVideo } from '@/types/local-playlist'

type DrivePlaylistPlayerProps = {
  videos: LocalPlaylistVideo[]
  className?: string
}

const LOADING_TIMEOUT_MS = 10000

/**
 * Builds a Drive preview URL that prefers autoplay for TV shells.
 *
 * @param fileId - Google Drive file id
 * @param autoplay - When true, request autoplay
 * @param nonce - Cache-buster so remounts restart playback
 */
const buildPreviewUrl = (fileId: string, autoplay: boolean, nonce: number): string => {
  const url = new URL(getDrivePreviewUrl(fileId))
  if (autoplay) {
    url.searchParams.set('autoplay', '1')
  }
  url.searchParams.set('usp', 'sharing')
  url.searchParams.set('t', String(nonce))
  return url.toString()
}

/**
 * Plays assigned Drive videos via Google's preview player (iframe).
 * On TV: full-screen, pop-out chrome covered, remote Back/Next/Play restart via remount.
 *
 * @param videos - Playlist entries whose `id` is the Drive file id
 */
export const DrivePlaylistPlayer = ({ videos, className }: DrivePlaylistPlayerProps) => {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [playNonce, setPlayNonce] = useState(1)
  const [wantsAutoplay, setWantsAutoplay] = useState(true)
  const tvMode = isTvApp()

  const activeVideo = videos[activeIndex] ?? videos[0]

  const previewUrl = useMemo(() => {
    if (!activeVideo) {
      return null
    }
    return buildPreviewUrl(activeVideo.id, wantsAutoplay, playNonce)
  }, [activeVideo, wantsAutoplay, playNonce])

  const remountPlayer = useCallback((autoplay: boolean) => {
    setWantsAutoplay(autoplay)
    setIsLoading(true)
    setPlayNonce((value) => value + 1)
  }, [])

  useEffect(() => {
    setActiveIndex(0)
    remountPlayer(true)
  }, [videos, remountPlayer])

  useEffect(() => {
    if (!previewUrl) {
      return
    }

    setIsLoading(true)
    const timeout = window.setTimeout(() => {
      setIsLoading(false)
    }, LOADING_TIMEOUT_MS)

    return () => window.clearTimeout(timeout)
  }, [previewUrl])

  // Kick autoplay once more after the first load — Xiaomi WebView often ignores attempt #1.
  useEffect(() => {
    if (!tvMode || !activeVideo) {
      return
    }

    const timer = window.setTimeout(() => {
      setWantsAutoplay(true)
      setIsLoading(true)
      setPlayNonce((value) => value + 1)
    }, 1500)

    return () => window.clearTimeout(timer)
    // Only re-kick when the Drive file changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tvMode, activeVideo?.id])

  useEffect(() => {
    if (!tvMode) {
      return
    }

    window.__lantaTvNextVideo = () => {
      setActiveIndex((index) => {
        const next = Math.min(videos.length - 1, index + 1)
        return next
      })
      remountPlayer(true)
      return 'ok'
    }
    window.__lantaTvPrevVideo = () => {
      setActiveIndex((index) => Math.max(0, index - 1))
      remountPlayer(true)
      return 'ok'
    }
    window.__lantaTvTogglePlay = () => {
      // Drive iframe cannot be paused cross-origin — remount with autoplay to (re)start.
      remountPlayer(true)
      return 'ok'
    }

    return () => {
      delete window.__lantaTvNextVideo
      delete window.__lantaTvPrevVideo
      delete window.__lantaTvTogglePlay
    }
  }, [tvMode, videos.length, remountPlayer])

  if (!activeVideo || !previewUrl) {
    return null
  }

  return (
    <div
      className={cn('flex h-full w-full flex-col bg-black', className)}
      onContextMenu={(event) => event.preventDefault()}
      data-tv-playback={tvMode ? 'true' : undefined}
    >
      <div
        className={cn(
          'relative min-h-0 flex-1 overflow-hidden bg-black',
          tvMode ? 'tv-drive-stage' : '',
        )}
      >
        <iframe
          key={`${activeVideo.id}-${playNonce}`}
          src={previewUrl}
          title={activeVideo.title}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          // allow-popups omitted so Drive cannot open the folder/file in a new surface.
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="strict-origin-when-cross-origin"
          className={cn(
            'border-0 bg-black',
            tvMode ? 'tv-drive-iframe' : 'absolute inset-0 h-full w-full',
          )}
          onLoad={() => setIsLoading(false)}
        />

        {/* Cover Drive pop-out / open-in-Drive controls */}
        <div className="drive-chrome-shield-popout" aria-hidden="true" />
        <div className="drive-chrome-shield-popout-wide" aria-hidden="true" />
        {tvMode ? (
          <>
            <div className="drive-chrome-shield-top" aria-hidden="true" />
            <div className="drive-chrome-shield-bottom" aria-hidden="true" />
            <div className="drive-chrome-shield-left" aria-hidden="true" />
            <div className="drive-chrome-shield-right" aria-hidden="true" />
          </>
        ) : null}

        {isLoading ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black text-sm text-white/70">
            Starting video…
          </div>
        ) : null}

        {tvMode ? (
          <p className="pointer-events-none absolute top-4 left-4 z-20 max-w-[70%] truncate text-sm text-white/80">
            {activeVideo.title}
          </p>
        ) : null}
      </div>

      {!tvMode && videos.length > 1 ? (
        <div
          className={cn(
            'flex h-[4.5rem] shrink-0 items-center justify-center gap-3 px-3',
            'border-t border-white/10 bg-black pb-[env(safe-area-inset-bottom)]',
          )}
        >
          <button
            type="button"
            disabled={activeIndex === 0}
            onClick={() => {
              setActiveIndex((index) => Math.max(0, index - 1))
              remountPlayer(true)
            }}
            className={navButtonClass}
            aria-label="Previous video"
          >
            <SkipBackIcon className="h-5 w-5" />
          </button>

          <p className="max-w-[50%] truncate text-center text-sm text-white/70">
            {activeVideo.title}
          </p>

          <button
            type="button"
            disabled={activeIndex >= videos.length - 1}
            onClick={() => {
              setActiveIndex((index) => Math.min(videos.length - 1, index + 1))
              remountPlayer(true)
            }}
            className={navButtonClass}
            aria-label="Next video"
          >
            <SkipForwardIcon className="h-5 w-5" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

type IconProps = {
  className?: string
}

const SkipBackIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={cn('fill-current', className)} aria-hidden="true">
    <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
  </svg>
)

const SkipForwardIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={cn('fill-current', className)} aria-hidden="true">
    <path d="m6 18 8.5-6L6 6v12zM16 6v12h2V6h-2z" />
  </svg>
)

const navButtonClass = cn(
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/80',
  'transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lanta-taupe/70',
)
