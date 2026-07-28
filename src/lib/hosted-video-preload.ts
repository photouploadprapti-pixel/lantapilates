/**
 * Background-preloads hosted MP4 URLs with hidden video elements so TV Play can start warm.
 * Cross-origin hosts often block fetch()/Cache API, but <video preload> still buffers.
 */

const preloadElements = new Map<string, HTMLVideoElement>()

/**
 * Starts buffering a remote MP4 in a detached video element.
 *
 * @param url - Absolute HTTPS video URL
 */
export const preloadHostedVideoUrl = (url: string): void => {
  if (typeof document === 'undefined' || !url) {
    return
  }

  if (preloadElements.has(url)) {
    return
  }

  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true
  video.setAttribute('playsinline', 'true')
  video.setAttribute('webkit-playsinline', 'true')
  video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px'
  video.src = url

  const cleanupWarmPlay = () => {
    try {
      video.pause()
      if (video.currentTime > 0.25) {
        video.currentTime = 0
      }
    } catch {
      // Ignore seek/pause races while metadata is loading.
    }
  }

  video.addEventListener('canplay', cleanupWarmPlay, { once: true })
  video.addEventListener('error', () => {
    preloadElements.delete(url)
    video.remove()
  }, { once: true })

  document.body.appendChild(video)
  preloadElements.set(url, video)

  // Silent warm-play helps Android WebView start downloading media data.
  void video.play().then(cleanupWarmPlay).catch(() => {
    // Autoplay may be blocked until a user gesture — preload="auto" still helps.
  })
}

/**
 * Preloads the first videos in a playlist (first is highest priority).
 *
 * @param urls - Ordered playable URLs
 * @param count - How many clips to warm (default 2)
 */
export const preloadHostedPlaylist = (urls: string[], count = 2): void => {
  urls.slice(0, Math.max(1, count)).forEach((url) => {
    preloadHostedVideoUrl(url)
  })
}

/**
 * Releases all detached preload video elements.
 */
export const clearHostedVideoPreloads = (): void => {
  preloadElements.forEach((video) => {
    try {
      video.pause()
      video.removeAttribute('src')
      video.load()
      video.remove()
    } catch {
      // Ignore cleanup errors.
    }
  })
  preloadElements.clear()
}
