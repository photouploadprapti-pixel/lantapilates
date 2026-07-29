'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'

import { useTvAutoFocus } from '@/hooks/use-tv-focus'
import { preloadHostedVideoUrl } from '@/lib/hosted-video-preload'
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
  /** When false, load/buffer media but do not start audible playback yet. */
  autoPlay?: boolean
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
 * Playlist player for hosted / local MP4 (and legacy MPEG-TS).
 * Full-bleed video with a compact bottom bar: Back · Prev · −10s · Play/Pause · +10s · Next.
 *
 * @param videos - Ordered playlist entries
 * @param className - Optional container classes
 * @param hideChrome - When true, hide the bottom control strip
 * @param onMpegTsFatalError - Optional fatal MPEG-TS error callback
 * @param onBack - Optional back navigation handler
 */
export const NativePlaylistPlayer = ({
  videos,
  className,
  hideChrome = false,
  autoPlay = true,
  onMpegTsFatalError,
  onBack,
}: NativePlaylistPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const mpegtsPlayerRef = useRef<MpegtsPlayer | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [isBuffering, setIsBuffering] = useState(false)
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const fatalNotifiedRef = useRef(false)
  const autoPlayRef = useRef(autoPlay)
  autoPlayRef.current = autoPlay

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
      if (index <= 0) {
        return index
      }
      setIsPlaying(true)
      return index - 1
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

          if (autoPlayRef.current) {
            await player.play()
            if (!cancelled) {
              setIsPlaying(true)
              setIsBuffering(false)
            }
          } else if (!cancelled) {
            // Warm only — do not muted-play/pause (that delays audible start on Play).
            setIsPlaying(false)
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
      element.preload = 'auto'
      try {
        if (autoPlayRef.current) {
          // Start immediately; keep buffering in the background while playing.
          const playAttempt = element.play()
          if (!cancelled) {
            setIsPlaying(true)
            setIsBuffering(element.readyState < 3)
          }
          await playAttempt
          if (!cancelled) {
            setIsBuffering(false)
          }
        } else {
          element.load()
          if (!cancelled) {
            setIsPlaying(false)
            setIsBuffering(false)
          }
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

  // When TV welcome flips from warm-preload → Play, start immediately (buffer while playing).
  useEffect(() => {
    if (!autoPlay) {
      return
    }

    const element = videoRef.current
    if (!element || playbackError) {
      return
    }

    element.muted = false
    setIsPlaying(true)
    setIsBuffering(element.readyState < 3)
    void element.play()
      .then(() => {
        setIsPlaying(true)
        setIsBuffering(false)
      })
      .catch(() => {
        setIsPlaying(false)
      })
  }, [autoPlay, playbackError, activeVideo])

  // Prefetch the next clip only after the current one is actually playing.
  useEffect(() => {
    if (!autoPlay || !isPlaying) {
      return
    }
    const next = videos[activeIndex + 1]
    if (!next?.src || shouldUseMpegTsPlayer(next)) {
      return
    }
    const timer = window.setTimeout(() => {
      preloadHostedVideoUrl(next.src)
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [activeIndex, videos, autoPlay, isPlaying])

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
    window.__lantaTvSeekBy = (seconds: number) => {
      const delta = typeof seconds === 'number' && Number.isFinite(seconds) ? seconds : 0
      handleSeek(delta)
      return 'ok'
    }

    return () => {
      delete window.__lantaTvTogglePlay
      delete window.__lantaTvNextVideo
      delete window.__lantaTvPrevVideo
      delete window.__lantaTvSeekBy
    }
  }, [handleTogglePlay, goNext, goPrev, handleSeek])

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

      if (key === 'MediaTrackPrevious') {
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
      className={cn('relative h-full w-full overflow-hidden bg-black', className)}
      onContextMenu={(event) => event.preventDefault()}
      data-tv-playback={remoteMode ? 'true' : undefined}
    >
      <div className="absolute inset-0 bg-black">
        <video
          ref={videoRef}
          title={activeVideo.title}
          playsInline
          preload="auto"
          className="h-full w-full bg-black object-contain"
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

        <p className="pointer-events-none absolute top-3 left-3 z-10 max-w-[70%] truncate text-xs text-white/75 sm:text-sm">
          {activeVideo.title}
          {videos.length > 1 ? ` · ${activeIndex + 1}/${videos.length}` : ''}
        </p>
      </div>

      {!hideChrome ? (
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-1.5 px-3 py-2.5',
            'bg-gradient-to-t from-black/90 via-black/70 to-transparent',
            'pb-[max(0.65rem,env(safe-area-inset-bottom))] sm:gap-2 sm:px-4 sm:py-3',
          )}
        >
          <button
            type="button"
            disabled={!onBack}
            onClick={() => onBack?.()}
            className={transportButtonClass}
            aria-label="Back"
          >
            Back
          </button>

          <button
            type="button"
            disabled={activeIndex <= 0}
            onClick={goPrev}
            className={transportButtonClass}
            aria-label="Previous video"
          >
            Prev
          </button>

          <button
            type="button"
            onClick={() => handleSeek(-SEEK_SECONDS)}
            className={transportButtonClass}
            aria-label={`Back ${SEEK_SECONDS} seconds`}
          >
            −{SEEK_SECONDS}s
          </button>

          <button
            type="button"
            onClick={handleTogglePlay}
            data-tv-autofocus="true"
            tabIndex={0}
            className={cn(transportButtonClass, 'min-w-[5.5rem] font-semibold sm:min-w-[6.5rem]')}
            aria-label={isPlaying ? 'Pause video' : 'Play video'}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <button
            type="button"
            onClick={() => handleSeek(SEEK_SECONDS)}
            className={transportButtonClass}
            aria-label={`Forward ${SEEK_SECONDS} seconds`}
          >
            +{SEEK_SECONDS}s
          </button>

          <button
            type="button"
            disabled={activeIndex >= videos.length - 1}
            onClick={goNext}
            className={transportButtonClass}
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
 * Compact transport control — smaller so six actions fit on TV remotes and phones.
 */
const transportButtonClass = cn(
  'flex h-10 min-w-0 flex-1 items-center justify-center rounded-sm px-1',
  'bg-[#E8E0D6] text-[11px] tracking-wide text-[#1A1A1A] uppercase sm:h-11 sm:text-xs',
  'transition-colors hover:bg-[#F2EDE8]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lanta-taupe/70',
  'disabled:cursor-not-allowed disabled:opacity-40',
)
