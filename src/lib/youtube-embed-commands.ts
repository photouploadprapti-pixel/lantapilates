const YOUTUBE_ORIGINS = new Set([
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
])

type YouTubeMessagePayload = {
  event?: string
  info?: unknown
}

const isYouTubeOrigin = (origin: string): boolean => YOUTUBE_ORIGINS.has(origin)

const parseYouTubeMessage = (payload: unknown): YouTubeMessagePayload | null => {
  if (typeof payload !== 'string') return null

  try {
    const data: unknown = JSON.parse(payload)
    if (typeof data !== 'object' || data === null || !('event' in data)) {
      return null
    }

    return data as YouTubeMessagePayload
  } catch {
    return null
  }
}

/**
 * Sends a playback command to an embedded YouTube iframe.
 * @param iframe - Mounted YouTube iframe element
 * @param func - YouTube player command name
 * @param args - Optional command arguments
 */
export const sendYouTubeCommand = (
  iframe: HTMLIFrameElement | null,
  func: string,
  args: unknown[] = [],
): void => {
  iframe?.contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func, args }),
    '*',
  )
}

/**
 * Subscribes to YouTube iframe info events (current time, duration, etc.).
 * @param iframe - Mounted YouTube iframe element
 */
export const startYouTubeListening = (iframe: HTMLIFrameElement | null): void => {
  iframe?.contentWindow?.postMessage(
    JSON.stringify({ event: 'listening', id: 'lanta-player', channel: 'widget' }),
    '*',
  )
}

/** Seconds to skip for coarse in-video seek controls */
export const YOUTUBE_COARSE_SEEK_SECONDS = 10

/** Seconds to skip for fine in-video seek controls */
export const YOUTUBE_FINE_SEEK_SECONDS = 5

/**
 * Seeks the embedded player relative to the current playback position.
 * @param iframe - Mounted YouTube iframe element
 * @param currentTime - Current playback position in seconds
 * @param offsetSeconds - Positive or negative seek offset
 * @param duration - Optional video duration used to clamp the target time
 */
export const seekYouTubeRelative = (
  iframe: HTMLIFrameElement | null,
  currentTime: number,
  offsetSeconds: number,
  duration?: number,
): void => {
  const target = Math.max(0, currentTime + offsetSeconds)
  const capped = duration !== undefined ? Math.min(duration, target) : target
  sendYouTubeCommand(iframe, 'seekTo', [capped, true])
}

/** YouTube player state: playing */
export const YOUTUBE_STATE_PLAYING = 1

/** YouTube player state: paused */
export const YOUTUBE_STATE_PAUSED = 2

export type YouTubePlaybackInfo = {
  currentTime: number
  duration: number
}

/**
 * Parses YouTube iframe postMessage events for player state changes.
 * @param event - Browser message event
 */
export const parseYouTubePlayerMessage = (
  event: MessageEvent,
): number | null => {
  if (!isYouTubeOrigin(event.origin)) return null

  const data = parseYouTubeMessage(event.data)
  if (
    data?.event === 'onStateChange'
    && typeof data.info === 'number'
  ) {
    return data.info
  }

  return null
}

/**
 * Parses YouTube iframe postMessage events for playback info updates.
 * @param event - Browser message event
 */
export const parseYouTubePlaybackInfo = (
  event: MessageEvent,
): YouTubePlaybackInfo | null => {
  if (!isYouTubeOrigin(event.origin)) return null

  const data = parseYouTubeMessage(event.data)
  if (data?.event !== 'infoDelivery' || typeof data.info !== 'object' || data.info === null) {
    return null
  }

  const info = data.info as Record<string, unknown>
  const currentTime = info.currentTime
  const duration = info.duration

  if (typeof currentTime !== 'number') return null

  return {
    currentTime,
    duration: typeof duration === 'number' ? duration : 0,
  }
}
