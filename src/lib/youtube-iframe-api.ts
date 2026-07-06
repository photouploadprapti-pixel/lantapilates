/**
 * Loads the YouTube IFrame API script once per page.
 */
export const loadYouTubeIframeApi = (): Promise<void> => {
  if (typeof window === 'undefined') {
    return Promise.resolve()
  }

  if (window.YT?.Player) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    let settled = false

    const finish = () => {
      if (settled || !window.YT?.Player) return
      settled = true
      window.clearInterval(poll)
      window.clearTimeout(timeout)
      resolve()
    }

    const previousReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.()
      finish()
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-youtube-iframe-api]')
    if (!existing) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.dataset.youtubeIframeApi = 'true'
      document.head.appendChild(script)
    }

    const poll = window.setInterval(finish, 200)
    const timeout = window.setTimeout(() => {
      settled = true
      window.clearInterval(poll)
      resolve()
    }, 15000)

    finish()
  })
}

export type YouTubePlayerInstance = {
  destroy: () => void
  playVideo: () => void
  pauseVideo: () => void
  nextVideo: () => void
  previousVideo: () => void
  getPlayerState: () => number
  loadPlaylist: (options: { listType: string, list: string }) => void
}

export const YOUTUBE_PLAYER_STATE_ENDED = 0
export const YOUTUBE_PLAYER_STATE_PLAYING = 1
export const YOUTUBE_PLAYER_STATE_PAUSED = 2

export type YouTubePlayerConfig = {
  videoId?: string
  height?: string | number
  width?: string | number
  playerVars?: Record<string, number | string>
  events?: {
    onReady?: (event: { target: YouTubePlayerInstance }) => void
    onStateChange?: (event: { data: number }) => void
    onError?: () => void
  }
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        config: YouTubePlayerConfig,
      ) => YouTubePlayerInstance
    }
    onYouTubeIframeAPIReady?: () => void
  }
}
