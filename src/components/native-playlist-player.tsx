'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { LocalPlaylistVideo } from '@/types/local-playlist'
import { cn } from '@/lib/utils'

type NativePlaylistPlayerProps = {
  videos: LocalPlaylistVideo[]
  className?: string
}

/**
 * Native HTML5 playlist player with play/pause only — no external branding.
 * @param videos - Synced local video files from the reformer playlist
 */
export const NativePlaylistPlayer = ({ videos, className }: NativePlaylistPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)

  const activeVideo = videos[activeIndex] ?? videos[0]

  const handleTogglePlay = useCallback(() => {
    const element = videoRef.current
    if (!element) return

    if (element.paused) {
      void element.play()
      setIsPlaying(true)
      return
    }

    element.pause()
    setIsPlaying(false)
  }, [])

  const handleEnded = () => {
    if (activeIndex < videos.length - 1) {
      setActiveIndex((index) => index + 1)
      setIsPlaying(true)
      return
    }

    setIsPlaying(false)
  }

  useEffect(() => {
    const element = videoRef.current
    if (!element) return
    void element.play()
  }, [activeVideo.src])

  if (!activeVideo) {
    return null
  }

  return (
    <div
      className={cn('flex h-full w-full flex-col bg-black', className)}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="relative min-h-0 flex-1 bg-black">
        <video
          ref={videoRef}
          key={activeVideo.src}
          src={activeVideo.src}
          title={activeVideo.title}
          autoPlay
          playsInline
          preload="auto"
          className="h-full w-full bg-black object-contain"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={handleEnded}
          onClick={handleTogglePlay}
          controlsList="nodownload noplaybackrate noremoteplayback"
          disablePictureInPicture
        />

        {!isPlaying ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <button
              type="button"
              onClick={handleTogglePlay}
              className={cn(
                'flex h-20 w-20 items-center justify-center rounded-full',
                'bg-lanta-taupe text-white shadow-lg transition-transform',
                'hover:scale-105 active:scale-95',
              )}
              aria-label="Play video"
            >
              <PlayIcon className="ml-1 h-10 w-10" />
            </button>
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          'flex h-[4.5rem] shrink-0 items-center justify-center gap-4',
          'border-t border-white/10 bg-black pb-[env(safe-area-inset-bottom)]',
        )}
      >
        {videos.length > 1 ? (
          <button
            type="button"
            disabled={activeIndex === 0}
            onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
            className={navButtonClass}
            aria-label="Previous video"
          >
            <SkipBackIcon className="h-5 w-5" />
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleTogglePlay}
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-full',
            'bg-lanta-taupe text-white transition-colors hover:bg-lanta-taupe/90',
          )}
          aria-label={isPlaying ? 'Pause video' : 'Play video'}
        >
          {isPlaying ? (
            <PauseIcon className="h-6 w-6" />
          ) : (
            <PlayIcon className="ml-0.5 h-6 w-6" />
          )}
        </button>

        {videos.length > 1 ? (
          <button
            type="button"
            disabled={activeIndex >= videos.length - 1}
            onClick={() => setActiveIndex((index) => Math.min(videos.length - 1, index + 1))}
            className={navButtonClass}
            aria-label="Next video"
          >
            <SkipForwardIcon className="h-5 w-5" />
          </button>
        ) : null}
      </div>
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
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
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
  'flex h-10 w-10 items-center justify-center rounded-full text-white/80',
  'transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30',
)
