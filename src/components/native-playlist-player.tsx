'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'

import { VideoLetterboxStage } from '@/components/video-letterbox-brand'
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
 * Formats seconds as `m:ss` or `h:mm:ss` for the player clock.
 *
 * @param totalSeconds - Playback position or duration in seconds
 */
const formatPlaybackClock = (totalSeconds: number): string => {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '0:00'
  }

  const whole = Math.floor(totalSeconds)
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const seconds = whole % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
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
 * Letterboxed stage with side branding; transport bar sits below the video
 * (Back · Prev · −10s · Play/Pause · +10s · Next) so controls never cover the picture.
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
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const fatalNotifiedRef = useRef(false)
  const autoPlayRef = useRef(autoPlay)
  autoPlayRef.current = autoPlay

  useTvAutoFocus(videos.length > 0 && !hideChrome)

  const activeVideo = videos[activeIndex] ?? videos[0]
  const remoteMode = usesTvRemoteControls() || isNativeApp()
  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0

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

    const mediaDuration = Number.isFinite(element.duration) ? element.duration : Number.POSITIVE_INFINITY
    const nextTime = Math.min(Math.max(0, element.currentTime + deltaSeconds), mediaDuration)
    element.currentTime = nextTime
    setCurrentTime(nextTime)
  }, [])

  /**
   * Seeks to a fraction of the known duration (progress bar interaction).
   *
   * @param ratio - 0–1 position within the clip
   */
  const handleSeekRatio = useCallback((ratio: number) => {
    const element = videoRef.current
    if (!element || !Number.isFinite(element.duration) || element.duration <= 0) {
      return
    }

    const nextTime = Math.min(Math.max(0, ratio), 1) * element.duration
    element.currentTime = nextTime
    setCurrentTime(nextTime)
  }, [])

  /**
   * Syncs clock labels from the HTML media element.
   */
  const syncPlaybackClock = useCallback(() => {
    const element = videoRef.current
    if (!element) {
      return
    }

    setCurrentTime(Number.isFinite(element.currentTime) ? element.currentTime : 0)
    setDuration(Number.isFinite(element.duration) ? element.duration : 0)
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
      setCurrentTime(0)
      setDuration(0)
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
      className={cn(
        'flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#1a1a1a]',
        className,
      )}
      onContextMenu={(event) => event.preventDefault()}
      data-tv-playback={remoteMode ? 'true' : undefined}
    >
      {/* Video stage fills everything above the transport bar (no overlay crop). */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <VideoLetterboxStage className="min-h-0 flex-1">
          <video
            ref={videoRef}
            title={activeVideo.title}
            playsInline
            preload="auto"
            className="max-h-full max-w-full h-auto w-auto bg-transparent object-contain"
            onPlay={() => {
              setIsPlaying(true)
              setIsBuffering(false)
            }}
            onPause={() => setIsPlaying(false)}
            onWaiting={() => setIsBuffering(true)}
            onPlaying={() => setIsBuffering(false)}
            onCanPlay={() => {
              setIsBuffering(false)
              syncPlaybackClock()
            }}
            onLoadedMetadata={syncPlaybackClock}
            onDurationChange={syncPlaybackClock}
            onTimeUpdate={syncPlaybackClock}
            onEnded={handleEnded}
            controlsList="nodownload noplaybackrate noremoteplayback"
            disablePictureInPicture
          />
        </VideoLetterboxStage>

        {playbackError ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1a1a1a]/85 px-6">
            <p className="max-w-md text-center text-sm text-lanta-sand/90">{playbackError}</p>
          </div>
        ) : null}

        {isBuffering && !playbackError ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#1a1a1a]/35">
            <p className="text-sm tracking-wide text-lanta-sand/80 uppercase">Loading…</p>
          </div>
        ) : null}

        <div
          className={cn(
            'absolute inset-x-0 bottom-0 z-20 px-3 pt-8 pb-2 sm:px-4 sm:pb-3',
            'bg-gradient-to-t from-black/80 via-black/40 to-transparent',
            'pointer-events-none',
          )}
        >
          <div className="pointer-events-auto mx-auto flex w-full max-w-4xl flex-col gap-1.5">
            <button
              type="button"
              className="group relative h-1.5 w-full overflow-hidden rounded-full bg-white/25"
              aria-label="Seek in video"
              onClick={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect()
                if (bounds.width <= 0) {
                  return
                }
                handleSeekRatio((event.clientX - bounds.left) / bounds.width)
              }}
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-lanta-sand transition-[width] duration-100 group-hover:bg-white"
                style={{ width: `${progressRatio * 100}%` }}
              />
            </button>
            <div className="flex items-center justify-between text-[11px] tracking-wide text-white/85 tabular-nums sm:text-xs">
              <span aria-label="Current time">{formatPlaybackClock(currentTime)}</span>
              <span aria-label="Total duration">{formatPlaybackClock(duration)}</span>
            </div>
          </div>
        </div>
      </div>

      {!hideChrome ? (
        <div
          className={cn(
            'flex h-16 shrink-0 items-center justify-center gap-1.5 px-3',
            'border-t border-white/10 bg-black',
            'pb-[env(safe-area-inset-bottom)] sm:gap-2 sm:px-4',
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
  'flex h-10 min-w-0 flex-1 items-center justify-center rounded-sm border-2 border-transparent px-1',
  'bg-[#E8E0D6] text-[11px] tracking-wide text-[#1A1A1A] uppercase sm:h-11 sm:text-xs',
  'transition-colors hover:bg-[#F2EDE8]',
  'focus:border-lanta-taupe focus:bg-[#F2EDE8] focus:outline-none',
  'focus:ring-4 focus:ring-lanta-taupe/50',
  'focus-visible:border-lanta-taupe focus-visible:ring-4 focus-visible:ring-lanta-taupe/50',
  'disabled:cursor-not-allowed disabled:opacity-40',
)
