'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { LANTA_REFORMER_PLAYLIST_ID } from '@/lib/youtube-playlist'
import {
  parseYouTubePlaybackInfo,
  parseYouTubePlayerMessage,
  seekYouTubeRelative,
  sendYouTubeCommand,
  startYouTubeListening,
  YOUTUBE_COARSE_SEEK_SECONDS,
  YOUTUBE_FINE_SEEK_SECONDS,
  YOUTUBE_STATE_PAUSED,
  YOUTUBE_STATE_PLAYING,
} from '@/lib/youtube-embed-commands'
import { getYouTubeEmbedUrl, getYouTubePlaylistEmbedUrl } from '@/lib/video-playback'
import { cn } from '@/lib/utils'

type YouTubeVideoPlayerProps = {
  playlistId?: string
  videoId?: string
  className?: string
}

const LOADING_TIMEOUT_MS = 6000

/**
 * Custom YouTube playlist player via iframe + postMessage (reliable on localhost and Netlify).
 * @param playlistId - YouTube playlist id (defaults to the reformer playlist)
 * @param videoId - Optional single-video id when no playlist is provided
 */
export const YouTubeVideoPlayer = ({
  playlistId = LANTA_REFORMER_PLAYLIST_ID,
  videoId,
  className,
}: YouTubeVideoPlayerProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const currentTimeRef = useRef(0)
  const durationRef = useRef(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const hasPlaylist = Boolean(playlistId)

  const embedUrl = useMemo(() => {
    const base = playlistId
      ? getYouTubePlaylistEmbedUrl(playlistId)
      : videoId
        ? getYouTubeEmbedUrl(videoId)
        : null

    if (!base || typeof window === 'undefined') return base

    const url = new URL(base)
    url.searchParams.set('origin', window.location.origin)
    url.searchParams.set('widget_referrer', window.location.origin)
    return url.toString()
  }, [playlistId, videoId])

  useEffect(() => {
    if (!embedUrl) return

    setIsLoading(true)

    const loadingTimeout = window.setTimeout(() => {
      setIsLoading(false)
    }, LOADING_TIMEOUT_MS)

    return () => window.clearTimeout(loadingTimeout)
  }, [embedUrl])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const playbackInfo = parseYouTubePlaybackInfo(event)
      if (playbackInfo) {
        currentTimeRef.current = playbackInfo.currentTime
        if (playbackInfo.duration > 0) {
          durationRef.current = playbackInfo.duration
        }
      }

      const state = parseYouTubePlayerMessage(event)
      if (state === YOUTUBE_STATE_PLAYING) {
        setIsPlaying(true)
        setIsLoading(false)
      }
      if (state === YOUTUBE_STATE_PAUSED) {
        setIsPlaying(false)
        setIsLoading(false)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  useEffect(() => {
    if (isLoading) return

    const pollPlayback = window.setInterval(() => {
      sendYouTubeCommand(iframeRef.current, 'getCurrentTime')
      sendYouTubeCommand(iframeRef.current, 'getDuration')
    }, 500)

    return () => window.clearInterval(pollPlayback)
  }, [isLoading])

  const handleIframeLoad = () => {
    setIsLoading(false)
    startYouTubeListening(iframeRef.current)
    sendYouTubeCommand(iframeRef.current, 'pauseVideo')
    sendYouTubeCommand(iframeRef.current, 'getCurrentTime')
    sendYouTubeCommand(iframeRef.current, 'getDuration')
    setIsPlaying(false)
  }

  const handleSeek = (offsetSeconds: number) => {
    seekYouTubeRelative(
      iframeRef.current,
      currentTimeRef.current,
      offsetSeconds,
      durationRef.current > 0 ? durationRef.current : undefined,
    )
    currentTimeRef.current = Math.max(
      0,
      Math.min(
        durationRef.current > 0 ? durationRef.current : Number.POSITIVE_INFINITY,
        currentTimeRef.current + offsetSeconds,
      ),
    )
  }

  const handleTogglePlay = () => {
    if (isPlaying) {
      sendYouTubeCommand(iframeRef.current, 'pauseVideo')
      setIsPlaying(false)
      return
    }

    sendYouTubeCommand(iframeRef.current, 'playVideo')
    setIsPlaying(true)
  }

  const handleNext = () => {
    sendYouTubeCommand(iframeRef.current, 'nextVideo')
    setIsPlaying(true)
  }

  const handlePrevious = () => {
    sendYouTubeCommand(iframeRef.current, 'previousVideo')
    setIsPlaying(true)
  }

  if (!embedUrl) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-black px-6 text-center',
          'text-sm text-white/70',
          className,
        )}
      >
        No video source configured.
      </div>
    )
  }

  return (
    <div
      className={cn('youtube-player-root relative h-full w-full bg-black', className)}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="youtube-player-stage absolute inset-0">
        <iframe
          ref={iframeRef}
          src={embedUrl}
          title="Workout video"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          className="youtube-player-iframe"
          onLoad={handleIframeLoad}
        />

        <div className="youtube-chrome-shield youtube-chrome-shield-right" aria-hidden="true" />
        <div className="youtube-chrome-shield youtube-chrome-shield-share" aria-hidden="true" />

        {isPlaying ? (
          <button
            type="button"
            className="absolute inset-0 z-[15]"
            onClick={handleTogglePlay}
            aria-label="Pause video"
          />
        ) : null}

        {!isPlaying && !isLoading ? (
          <div className="absolute inset-0 z-[20] flex items-center justify-center bg-black/60">
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

        {isLoading ? (
          <div className="absolute inset-0 z-[40] flex items-center justify-center bg-black text-sm text-white/70">
            Loading video…
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          'absolute inset-x-0 bottom-0 z-30 flex h-[4.5rem] items-center justify-center gap-2 px-3',
          'border-t border-white/10 bg-black pb-[env(safe-area-inset-bottom)] sm:gap-3',
        )}
      >
        {hasPlaylist ? (
          <button
            type="button"
            onClick={handlePrevious}
            className={navButtonClass}
            aria-label="Previous workout"
          >
            <SkipBackIcon className="h-5 w-5" />
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => handleSeek(-YOUTUBE_FINE_SEEK_SECONDS)}
          className={navButtonClass}
          aria-label={`Back ${YOUTUBE_FINE_SEEK_SECONDS} seconds`}
        >
          <TuneBackIcon className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => handleSeek(-YOUTUBE_COARSE_SEEK_SECONDS)}
          className={seekButtonClass}
          aria-label={`Back ${YOUTUBE_COARSE_SEEK_SECONDS} seconds`}
        >
          <SeekBackIcon seconds={YOUTUBE_COARSE_SEEK_SECONDS} />
        </button>

        <button
          type="button"
          onClick={handleTogglePlay}
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
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

        <button
          type="button"
          onClick={() => handleSeek(YOUTUBE_COARSE_SEEK_SECONDS)}
          className={seekButtonClass}
          aria-label={`Forward ${YOUTUBE_COARSE_SEEK_SECONDS} seconds`}
        >
          <SeekForwardIcon seconds={YOUTUBE_COARSE_SEEK_SECONDS} />
        </button>

        <button
          type="button"
          onClick={() => handleSeek(YOUTUBE_FINE_SEEK_SECONDS)}
          className={navButtonClass}
          aria-label={`Forward ${YOUTUBE_FINE_SEEK_SECONDS} seconds`}
        >
          <TuneForwardIcon className="h-5 w-5" />
        </button>

        {hasPlaylist ? (
          <button
            type="button"
            onClick={handleNext}
            className={navButtonClass}
            aria-label="Next workout"
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

const TuneBackIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={cn('fill-current', className)} aria-hidden="true">
    <path d="M11.99 5V1.01L8.99 4 12 6.99V5c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
  </svg>
)

const TuneForwardIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={cn('fill-current', className)} aria-hidden="true">
    <path d="M12 5V1.01L15 4l-3.01 2.99V5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
  </svg>
)

type SeekIconProps = IconProps & {
  seconds: number
}

const SeekBackIcon = ({ className, seconds }: SeekIconProps) => (
  <svg viewBox="0 0 24 24" className={cn('fill-current', className)} aria-hidden="true">
    <path d="M11.99 5V1.01L8.99 4 12 6.99V5c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
    <text
      x="12"
      y="15.5"
      textAnchor="middle"
      fontSize="7"
      fontWeight="700"
      fill="currentColor"
      stroke="none"
    >
      {seconds}
    </text>
  </svg>
)

const SeekForwardIcon = ({ className, seconds }: SeekIconProps) => (
  <svg viewBox="0 0 24 24" className={cn('fill-current', className)} aria-hidden="true">
    <path d="M12 5V1.01L15 4l-3.01 2.99V5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
    <text
      x="12"
      y="15.5"
      textAnchor="middle"
      fontSize="7"
      fontWeight="700"
      fill="currentColor"
      stroke="none"
    >
      {seconds}
    </text>
  </svg>
)

const navButtonClass = cn(
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/80',
  'transition-colors hover:bg-white/10',
)

const seekButtonClass = cn(
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/80',
  'transition-colors hover:bg-white/10',
)
