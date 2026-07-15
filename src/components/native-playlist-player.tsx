'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'

import { isMpegTsFileName } from '@/lib/local-video-catalog'
import { isNativeApp } from '@/lib/is-native-app'
import { cn } from '@/lib/utils'
import { LocalVideos } from '@/plugins/local-videos'
import type { LocalPlaylistVideo } from '@/types/local-playlist'

type MpegtsModule = typeof import('mpegts.js').default
type MpegtsPlayer = ReturnType<MpegtsModule['createPlayer']>

type NativePlaylistPlayerProps = {
  videos: LocalPlaylistVideo[]
  className?: string
}

/**
 * Resolves whether a playlist entry should use the MPEG-TS (mse) player.
 *
 * @param video - Playlist video entry
 */
const shouldUseMpegTsPlayer = (video: LocalPlaylistVideo): boolean => {
  if (video.fileName && isMpegTsFileName(video.fileName)) {
    return true
  }

  try {
    const path = new URL(video.src, window.location.href).pathname
    return isMpegTsFileName(path)
  } catch {
    return isMpegTsFileName(video.src)
  }
}

/**
 * Makes a local video URL fetchable by mpegts.js (especially Android content:// URIs).
 *
 * @param video - Playlist video entry
 */
const resolvePlayableSrc = async (video: LocalPlaylistVideo): Promise<string> => {
  if (!isNativeApp()) {
    return video.src
  }

  if (!shouldUseMpegTsPlayer(video)) {
    return video.src.startsWith('/') || video.src.startsWith('file:')
      ? Capacitor.convertFileSrc(video.src)
      : video.src
  }

  try {
    const resolved = await LocalVideos.resolvePlaybackUrl({
      uri: video.src,
      name: video.fileName ?? 'video.ts',
    })
    return Capacitor.convertFileSrc(resolved.playbackUrl)
  } catch {
    return video.src.startsWith('content:')
      ? video.src
      : Capacitor.convertFileSrc(video.src)
  }
}

/**
 * Playlist player that uses native HTML5 for common containers and mpegts.js for .ts.
 *
 * @param videos - Ordered local playlist entries
 */
export const NativePlaylistPlayer = ({ videos, className }: NativePlaylistPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const mpegtsPlayerRef = useRef<MpegtsPlayer | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [playbackError, setPlaybackError] = useState<string | null>(null)

  const activeVideo = videos[activeIndex] ?? videos[0]

  const destroyMpegTsPlayer = useCallback(() => {
    const player = mpegtsPlayerRef.current
    if (!player) {
      return
    }

    try {
      player.pause()
      player.unload()
      player.detachMediaElement()
      player.destroy()
    } catch {
      // Player may already be destroyed during unmount races.
    }

    mpegtsPlayerRef.current = null
  }, [])

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
    if (!element || !activeVideo) {
      return
    }

    let cancelled = false

    const startPlayback = async () => {
      setPlaybackError(null)
      destroyMpegTsPlayer()
      element.removeAttribute('src')
      element.load()

      const useMpegTs = shouldUseMpegTsPlayer(activeVideo)
      const playableSrc = await resolvePlayableSrc(activeVideo)

      if (cancelled) {
        return
      }

      if (useMpegTs) {
        // mpegts.js touches `window` at module load — import only in the browser.
        const mpegts = (await import('mpegts.js')).default

        if (!mpegts.isSupported()) {
          setPlaybackError('This browser cannot play MPEG-TS (.ts) videos.')
          setIsPlaying(false)
          return
        }

        try {
          const player = mpegts.createPlayer(
            {
              type: 'mpegts',
              isLive: false,
              url: playableSrc,
            },
            {
              enableWorker: true,
              enableStashBuffer: true,
              autoCleanupSourceBuffer: true,
            },
          )

          mpegtsPlayerRef.current = player
          player.attachMediaElement(element)
          player.load()

          player.on(mpegts.Events.ERROR, () => {
            setPlaybackError(
              'Could not play this .ts video. The file may be damaged or unsupported.',
            )
            setIsPlaying(false)
          })

          await player.play()
          if (!cancelled) {
            setIsPlaying(true)
          }
        } catch (error) {
          if (!cancelled) {
            setPlaybackError(
              error instanceof Error ? error.message : 'Could not start MPEG-TS playback.',
            )
            setIsPlaying(false)
          }
        }
        return
      }

      element.src = playableSrc
      try {
        await element.play()
        if (!cancelled) {
          setIsPlaying(true)
        }
      } catch {
        if (!cancelled) {
          setIsPlaying(false)
        }
      }
    }

    void startPlayback()

    return () => {
      cancelled = true
      destroyMpegTsPlayer()
    }
  }, [activeVideo, destroyMpegTsPlayer])

  useEffect(() => {
    return () => {
      destroyMpegTsPlayer()
    }
  }, [destroyMpegTsPlayer])

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
          title={activeVideo.title}
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

        {playbackError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-6">
            <p className="max-w-md text-center text-sm text-white/80">{playbackError}</p>
          </div>
        ) : null}

        {!isPlaying && !playbackError ? (
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
