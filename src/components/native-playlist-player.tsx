'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'

import { useTvAutoFocus } from '@/hooks/use-tv-focus'
import { isMpegTsFileName } from '@/lib/local-video-catalog'
import { isNativeApp } from '@/lib/is-native-app'
import { isTvApp, usesTvRemoteControls } from '@/lib/is-tv-app'
import { cn } from '@/lib/utils'
import { LocalVideos } from '@/plugins/local-videos'
import type { LocalPlaylistVideo } from '@/types/local-playlist'

type MpegtsModule = typeof import('mpegts.js').default
type MpegtsPlayer = ReturnType<MpegtsModule['createPlayer']>

type NativePlaylistPlayerProps = {
  videos: LocalPlaylistVideo[]
  className?: string
  /** Hide on-screen transport controls (TV shell provides native buttons). */
  hideChrome?: boolean
  /** Called when MPEG-TS playback fails fatally (e.g. switch to Drive embed on TV). */
  onMpegTsFatalError?: () => void
  /** Optional Back handler (offline welcome / tablet home). */
  onBack?: () => void
}

const SEEK_SECONDS = 10

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

  const needsNativeResolve =
    video.src.startsWith('/')
    || video.src.startsWith('content:')
    || video.src.startsWith('file:')
    || shouldUseMpegTsPlayer(video)

  if (needsNativeResolve) {
    try {
      const resolved = await LocalVideos.resolvePlaybackUrl({
        uri: video.src,
        name: video.fileName ?? 'video.ts',
      })
      return Capacitor.convertFileSrc(resolved.playbackUrl)
    } catch {
      return video.src.startsWith('/') || video.src.startsWith('file:')
        ? Capacitor.convertFileSrc(video.src.replace(/^file:\/\//, ''))
        : video.src
    }
  }

  return video.src.startsWith('/') || video.src.startsWith('file:')
    ? Capacitor.convertFileSrc(video.src)
    : video.src
}

/**
 * Playlist player for offline / local files.
 * Bottom bar matches the online TV controls: Back · Play/Pause · Next.
 *
 * @param videos - Ordered local playlist entries
 * @param className - Optional container classes
 * @param hideChrome - When true, hide the bottom control strip
 * @param onMpegTsFatalError - Optional fatal MPEG-TS error callback
 * @param onBack - Optional back navigation handler
 */
export const NativePlaylistPlayer = ({
  videos,
  className,
  hideChrome = false,
  onMpegTsFatalError,
  onBack,
}: NativePlaylistPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const mpegtsPlayerRef = useRef<MpegtsPlayer | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isBuffering, setIsBuffering] = useState(false)
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const fatalNotifiedRef = useRef(false)

  useTvAutoFocus(videos.length > 0 && !hideChrome)

  const activeVideo = videos[activeIndex] ?? videos[0]
  const remoteMode = usesTvRemoteControls() || isNativeApp()

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

  const handleSeek = useCallback((deltaSeconds: number) => {
    const element = videoRef.current
    if (!element) return

    const duration = Number.isFinite(element.duration) ? element.duration : Number.POSITIVE_INFINITY
    const nextTime = Math.min(Math.max(0, element.currentTime + deltaSeconds), duration)
    element.currentTime = nextTime
  }, [])

  const handleEnded = () => {
    if (activeIndex < videos.length - 1) {
      setActiveIndex((index) => index + 1)
      setIsPlaying(true)
      return
    }

    setIsPlaying(false)
  }

  const goNext = useCallback(() => {
    setActiveIndex((index) => {
      if (index >= videos.length - 1) {
        return index
      }
      setIsPlaying(true)
      return index + 1
    })
  }, [videos.length])

  const goPrev = useCallback(() => {
    setActiveIndex((index) => {
      const next = Math.max(0, index - 1)
      if (next !== index) {
        setIsPlaying(true)
      }
      return next
    })
  }, [])

  useEffect(() => {
    const element = videoRef.current
    if (!element || !activeVideo) {
      return
    }

    let cancelled = false

    const startPlayback = async () => {
      setPlaybackError(null)
      setIsBuffering(true)
      fatalNotifiedRef.current = false
      destroyMpegTsPlayer()
      element.removeAttribute('src')
      element.load()

      const useMpegTs = shouldUseMpegTsPlayer(activeVideo)
      const playableSrc = await resolvePlayableSrc(activeVideo)

      if (cancelled) {
        return
      }

      if (useMpegTs) {
        const mpegts = (await import('mpegts.js')).default

        if (!mpegts.isSupported()) {
          setPlaybackError('This browser cannot play MPEG-TS (.ts) videos.')
          setIsPlaying(false)
          setIsBuffering(false)
          if (onMpegTsFatalError && !fatalNotifiedRef.current) {
            fatalNotifiedRef.current = true
            onMpegTsFatalError()
          }
          return
        }

        try {
          const onAndroidShell = isNativeApp() || isTvApp()
          // Large stash + no lazy-load reduces USB/TV underrun glitches.
          const stashBytes = onAndroidShell ? 4 * 1024 * 1024 : 512 * 1024
          const player = mpegts.createPlayer(
            {
              type: 'mpegts',
              isLive: false,
              cors: true,
              withCredentials: false,
              url: playableSrc,
            },
            {
              enableWorker: !onAndroidShell,
              enableStashBuffer: true,
              stashInitialSize: stashBytes,
              lazyLoad: false,
              autoCleanupSourceBuffer: true,
              // Keep more decoded history so cleanup itself does not hitch.
              autoCleanupMaxBackwardDuration: 240,
              autoCleanupMinBackwardDuration: 180,
              fixAudioTimestampGap: true,
              accurateSeek: false,
              seekType: 'range',
              rangeLoadZeroStart: false,
              reuseRedirectedURL: true,
              liveBufferLatencyChasing: false,
            },
          )

          mpegtsPlayerRef.current = player
          player.attachMediaElement(element)
          player.load()

          player.on(mpegts.Events.ERROR, (errorType, errorDetail, errorInfo) => {
            const detailParts = [errorType, errorDetail]
            if (errorInfo && typeof errorInfo === 'object' && 'msg' in errorInfo) {
              detailParts.push(String((errorInfo as { msg?: string }).msg ?? ''))
            }
            const detail = detailParts
              .map((part) => {
                if (typeof part === 'string') return part
                if (part && typeof part === 'object' && 'msg' in part) {
                  return String((part as { msg?: string }).msg ?? '')
                }
                return ''
              })
              .filter(Boolean)
              .join(' — ')

            setPlaybackError(
              detail
                ? `Could not play this .ts video: ${detail}`
                : 'Could not play this .ts video on this device.',
            )
            setIsPlaying(false)
            setIsBuffering(false)
            if (onMpegTsFatalError && !fatalNotifiedRef.current) {
              fatalNotifiedRef.current = true
              onMpegTsFatalError()
            }
          })

          try {
            element.preload = 'auto'
          } catch {
            // Ignore read-only attribute edge cases.
          }

          await player.play()
          if (!cancelled) {
            setIsPlaying(true)
            setIsBuffering(false)
          }
        } catch (error) {
          if (!cancelled) {
            setPlaybackError(
              error instanceof Error
                ? `Could not start MPEG-TS playback: ${error.message}`
                : 'Could not start MPEG-TS playback.',
            )
            setIsPlaying(false)
            setIsBuffering(false)
            if (onMpegTsFatalError && !fatalNotifiedRef.current) {
              fatalNotifiedRef.current = true
              onMpegTsFatalError()
            }
          }
        }
        return
      }

      element.src = playableSrc
      try {
        await element.play()
        if (!cancelled) {
          setIsPlaying(true)
          setIsBuffering(false)
        }
      } catch {
        if (!cancelled) {
          setIsPlaying(false)
          setIsBuffering(false)
        }
      }
    }

    void startPlayback()

    return () => {
      cancelled = true
      destroyMpegTsPlayer()
    }
  }, [activeVideo, destroyMpegTsPlayer, onMpegTsFatalError])

  useEffect(() => {
    return () => {
      destroyMpegTsPlayer()
    }
  }, [destroyMpegTsPlayer])

  useEffect(() => {
    window.__lantaTvTogglePlay = () => {
      handleTogglePlay()
      return 'ok'
    }
    window.__lantaTvNextVideo = () => {
      goNext()
      return 'ok'
    }
    window.__lantaTvPrevVideo = () => {
      goPrev()
      return 'ok'
    }

    return () => {
      delete window.__lantaTvTogglePlay
      delete window.__lantaTvNextVideo
      delete window.__lantaTvPrevVideo
    }
  }, [handleTogglePlay, goNext, goPrev])

  useEffect(() => {
    if (!remoteMode) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key
      const target = event.target
      const focusOnControl =
        target instanceof HTMLElement
        && Boolean(target.closest('button, a, input, textarea, select'))

      if (key === 'MediaPlayPause' || key === 'MediaPlay' || key === 'MediaPause') {
        event.preventDefault()
        handleTogglePlay()
        return
      }

      if (key === ' ' && !focusOnControl) {
        event.preventDefault()
        handleTogglePlay()
        return
      }

      if ((key === 'ArrowLeft' || key === 'MediaRewind') && !focusOnControl) {
        event.preventDefault()
        handleSeek(-SEEK_SECONDS)
        return
      }

      if ((key === 'ArrowRight' || key === 'MediaFastForward') && !focusOnControl) {
        event.preventDefault()
        handleSeek(SEEK_SECONDS)
        return
      }

      if (key === 'MediaTrackPrevious' && activeIndex > 0) {
        event.preventDefault()
        goPrev()
        return
      }

      if (key === 'MediaTrackNext' && activeIndex < videos.length - 1) {
        event.preventDefault()
        goNext()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [remoteMode, handleTogglePlay, handleSeek, activeIndex, videos.length, goNext, goPrev])

  if (!activeVideo) {
    return null
  }

  return (
    <div
      className={cn('flex h-full w-full flex-col bg-black', className)}
      onContextMenu={(event) => event.preventDefault()}
      data-tv-playback={remoteMode ? 'true' : undefined}
    >
      <div className="relative min-h-0 flex-1 bg-black">
        <video
          ref={videoRef}
          title={activeVideo.title}
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full bg-black object-contain"
          onPlay={() => {
            setIsPlaying(true)
            setIsBuffering(false)
          }}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onCanPlay={() => setIsBuffering(false)}
          onEnded={handleEnded}
          controlsList="nodownload noplaybackrate noremoteplayback"
          disablePictureInPicture
        />

        {playbackError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-6">
            <p className="max-w-md text-center text-sm text-white/80">{playbackError}</p>
          </div>
        ) : null}

        {isBuffering && !playbackError ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/30">
            <p className="text-sm tracking-wide text-white/80 uppercase">Loading…</p>
          </div>
        ) : null}

        <p className="pointer-events-none absolute top-4 left-4 z-10 max-w-[70%] truncate text-sm text-white/80">
          {activeVideo.title}
          {videos.length > 1 ? ` · ${activeIndex + 1}/${videos.length}` : ''}
        </p>
      </div>

      {!hideChrome ? (
        <div
          className={cn(
            'flex shrink-0 items-center justify-center gap-3 px-6 py-5',
            'bg-black/80 pb-[max(1.25rem,env(safe-area-inset-bottom))]',
          )}
        >
          <button
            type="button"
            onClick={() => {
              if (onBack) {
                onBack()
                return
              }
              goPrev()
            }}
            className={onlineBarButtonClass}
            aria-label="Back"
          >
            Back
          </button>

          <button
            type="button"
            onClick={handleTogglePlay}
            data-tv-autofocus="true"
            tabIndex={0}
            className={cn(onlineBarButtonClass, 'font-semibold')}
            aria-label={isPlaying ? 'Pause video' : 'Play video'}
          >
            Play / Pause
          </button>

          <button
            type="button"
            disabled={activeIndex >= videos.length - 1}
            onClick={goNext}
            className={onlineBarButtonClass}
            aria-label="Next video"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Online-TV-style control button: large, equal-width, easy D-pad targets.
 */
const onlineBarButtonClass = cn(
  'flex h-16 min-w-0 flex-1 items-center justify-center rounded-sm',
  'bg-[#E8E0D6] text-base tracking-wide text-[#1A1A1A] uppercase',
  'transition-colors hover:bg-[#F2EDE8]',
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lanta-taupe/70',
  'disabled:cursor-not-allowed disabled:opacity-40',
)
