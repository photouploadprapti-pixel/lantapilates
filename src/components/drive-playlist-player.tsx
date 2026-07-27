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
 * Builds a Drive preview URL with optional autoplay + cache bust.
 *
 * @param fileId - Google Drive file id
 * @param nonce - Cache-buster so remounts restart playback
 */
const buildPreviewUrl = (fileId: string, nonce: number): string => {
  const url = new URL(getDrivePreviewUrl(fileId))
  url.searchParams.set('autoplay', '1')
  url.searchParams.set('usp', 'sharing')
  url.searchParams.set('t', String(nonce))
  return url.toString()
}

/**
 * Plays assigned Drive videos via Google's preview player (iframe).
 * Play/Pause works by mounting/unmounting the iframe (Drive is cross-origin).
 * Next/Previous advance the playlist and remount with autoplay.
 *
 * @param videos - Playlist entries whose `id` is the Drive file id
 */
export const DrivePlaylistPlayer = ({ videos, className }: DrivePlaylistPlayerProps) => {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [playNonce, setPlayNonce] = useState(1)
  const [isPlaying, setIsPlaying] = useState(true)
  const tvMode = isTvApp()

  const activeVideo = videos[activeIndex] ?? videos[0]

  const previewUrl = useMemo(() => {
    if (!activeVideo || !isPlaying) {
      return null
    }
    return buildPreviewUrl(activeVideo.id, playNonce)
  }, [activeVideo, isPlaying, playNonce])

  const startPlayback = useCallback(() => {
    setIsPlaying(true)
    setIsLoading(true)
    setPlayNonce((value) => value + 1)
  }, [])

  const togglePlayback = useCallback(() => {
    setIsPlaying((playing) => {
      if (playing) {
        setIsLoading(false)
        return false
      }
      setIsLoading(true)
      setPlayNonce((value) => value + 1)
      return true
    })
  }, [])

  useEffect(() => {
    setActiveIndex(0)
    startPlayback()
  }, [videos, startPlayback])

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

  useEffect(() => {
    if (!tvMode) {
      return
    }

    window.__lantaTvNextVideo = () => {
      setActiveIndex((index) => Math.min(videos.length - 1, index + 1))
      setIsPlaying(true)
      setIsLoading(true)
      setPlayNonce((value) => value + 1)
      return 'ok'
    }
    window.__lantaTvPrevVideo = () => {
      setActiveIndex((index) => Math.max(0, index - 1))
      setIsPlaying(true)
      setIsLoading(true)
      setPlayNonce((value) => value + 1)
      return 'ok'
    }
    window.__lantaTvTogglePlay = () => {
      togglePlayback()
      return 'ok'
    }

    return () => {
      delete window.__lantaTvNextVideo
      delete window.__lantaTvPrevVideo
      delete window.__lantaTvTogglePlay
    }
  }, [tvMode, videos.length, togglePlayback])

  if (!activeVideo) {
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
        {isPlaying && previewUrl ? (
          <iframe
            key={`${activeVideo.id}-${playNonce}`}
            src={previewUrl}
            title={activeVideo.title}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            referrerPolicy="strict-origin-when-cross-origin"
            className={cn(
              'border-0 bg-black',
              tvMode ? 'tv-drive-iframe' : 'absolute inset-0 h-full w-full',
            )}
            onLoad={() => setIsLoading(false)}
          />
        ) : null}

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

        {isLoading && isPlaying ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black text-sm text-white/70">
            Starting video…
          </div>
        ) : null}

        {!isPlaying ? (
          <button
            type="button"
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/85"
            onClick={startPlayback}
            aria-label="Play video"
          >
            <span
              className={cn(
                'flex h-24 w-24 items-center justify-center rounded-full',
                'bg-lanta-taupe text-white shadow-lg',
              )}
            >
              <PlayIcon className="ml-1 h-12 w-12" />
            </span>
            <span className="text-sm tracking-wide text-white/80 uppercase">Paused — press Play</span>
          </button>
        ) : null}

        {tvMode ? (
          <p className="pointer-events-none absolute top-4 left-4 z-20 max-w-[70%] truncate text-sm text-white/80">
            {activeVideo.title}
            {videos.length > 1 ? ` · ${activeIndex + 1}/${videos.length}` : ''}
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
              startPlayback()
            }}
            className={navButtonClass}
            aria-label="Previous video"
          >
            <SkipBackIcon className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={togglePlayback}
            className={navButtonClass}
            aria-label={isPlaying ? 'Pause video' : 'Play video'}
          >
            {isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
          </button>

          <button
            type="button"
            disabled={activeIndex >= videos.length - 1}
            onClick={() => {
              setActiveIndex((index) => Math.min(videos.length - 1, index + 1))
              startPlayback()
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

const PlayIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={cn('fill-current', className)} aria-hidden="true">
    <path d="M8 5v14l11-7z" />
  </svg>
)

const PauseIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={cn('fill-current', className)} aria-hidden="true">
    <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
  </svg>
)

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
