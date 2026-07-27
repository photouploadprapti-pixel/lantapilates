'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
 * Builds a Drive preview URL with autoplay and cache bust.
 *
 * @param fileId - Google Drive file id
 * @param nonce - Cache-buster when switching videos
 */
const buildPreviewUrl = (fileId: string, nonce: number): string => {
  const url = new URL(getDrivePreviewUrl(fileId))
  url.searchParams.set('autoplay', '1')
  url.searchParams.set('usp', 'sharing')
  url.searchParams.set('_cb', String(nonce))
  return url.toString()
}

/**
 * Plays assigned Drive videos via Google's preview player (iframe).
 * Pause keeps the iframe mounted so the native TV shell can freeze/resume
 * WebView media mid-video (unmounting would restart from 0).
 *
 * @param videos - Playlist entries whose `id` is the Drive file id
 */
export const DrivePlaylistPlayer = ({ videos, className }: DrivePlaylistPlayerProps) => {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [playNonce, setPlayNonce] = useState(1)
  const [isPlaying, setIsPlaying] = useState(true)
  const isPlayingRef = useRef(true)
  const activeIndexRef = useRef(0)
  const videosRef = useRef(videos)
  const tvMode = isTvApp()

  videosRef.current = videos
  activeIndexRef.current = activeIndex
  isPlayingRef.current = isPlaying

  const activeVideo = videos[activeIndex] ?? videos[0]

  const previewUrl = useMemo(() => {
    if (!activeVideo) {
      return null
    }
    return buildPreviewUrl(activeVideo.id, playNonce)
  }, [activeVideo, playNonce])

  const startPlayback = useCallback(() => {
    isPlayingRef.current = true
    setIsPlaying(true)
  }, [])

  const togglePlayback = useCallback(() => {
    if (isPlayingRef.current) {
      isPlayingRef.current = false
      setIsPlaying(false)
      return 'paused'
    }
    isPlayingRef.current = true
    setIsPlaying(true)
    return 'playing'
  }, [])

  const remountVideo = useCallback((index: number) => {
    activeIndexRef.current = index
    setActiveIndex(index)
    isPlayingRef.current = true
    setIsPlaying(true)
    setIsLoading(true)
    setPlayNonce((value) => value + 1)
  }, [])

  const goNext = useCallback(() => {
    const last = Math.max(0, videosRef.current.length - 1)
    const next = Math.min(last, activeIndexRef.current + 1)
    remountVideo(next)
    return next === last ? 'ok-last' : 'ok'
  }, [remountVideo])

  const goPrev = useCallback(() => {
    const prev = Math.max(0, activeIndexRef.current - 1)
    remountVideo(prev)
    return 'ok'
  }, [remountVideo])

  useEffect(() => {
    remountVideo(0)
  }, [videos, remountVideo])

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
    window.__lantaTvNextVideo = () => goNext()
    window.__lantaTvPrevVideo = () => goPrev()
    window.__lantaTvTogglePlay = () => togglePlayback()

    return () => {
      delete window.__lantaTvNextVideo
      delete window.__lantaTvPrevVideo
      delete window.__lantaTvTogglePlay
    }
  }, [goNext, goPrev, togglePlayback])

  if (!activeVideo || !previewUrl) {
    return null
  }

  return (
    <div
      className={cn('flex h-full w-full flex-col bg-black', className)}
      onContextMenu={(event) => event.preventDefault()}
      data-tv-playback={tvMode ? 'true' : undefined}
      data-lanta-playing={isPlaying ? '1' : '0'}
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
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="strict-origin-when-cross-origin"
          className={cn(
            'border-0 bg-black',
            tvMode ? 'tv-drive-iframe' : 'absolute inset-0 h-full w-full',
            !isPlaying ? 'invisible' : '',
          )}
          onLoad={() => setIsLoading(false)}
        />

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
            data-lanta-paused="1"
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
            onClick={() => goPrev()}
            className={navButtonClass}
            aria-label="Previous video"
          >
            <SkipBackIcon className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => togglePlayback()}
            className={navButtonClass}
            aria-label={isPlaying ? 'Pause video' : 'Play video'}
          >
            {isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
          </button>

          <button
            type="button"
            disabled={activeIndex >= videos.length - 1}
            onClick={() => goNext()}
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
