/** Public base URL for Lanta workout MP4s on a2hosting. */
export const HOSTED_VIDEOS_BASE_URL = 'https://nrzmszcz.a2hosted.com/LantaVideos'

export type HostedVideoFile = {
  /** Same as file name — used as the assignment id. */
  id: string
  name: string
}

/**
 * Seed catalog of known uploaded MP4s (directory listing is disabled on the host).
 * Admin can extend this list via settings.
 */
export const DEFAULT_HOSTED_VIDEO_CATALOG: HostedVideoFile[] = [
  'Beginner-Arms & Back 39.mp4',
  'Beginner-Beginner Full Body 20.mp4',
  'Beginner-Beginner Full Body 38.mp4',
  'Beginner-Beginner Taster 1 - Foundations.mp4',
  'Beginner-Intro To Reformer Pilates With Emma.mp4',
  'Intermediate-Athletic 45.mp4',
  'Intermediate-Cardio Blast 32.mp4',
].map((name) => ({ id: name, name }))

/**
 * Builds a playable HTTPS URL for a hosted MP4 file name.
 *
 * @param fileName - Exact file name on the server (may include spaces / &)
 */
export const getHostedVideoUrl = (fileName: string): string => {
  const trimmed = fileName.trim()
  const encoded = encodeURIComponent(trimmed).replace(/%2F/g, '/')
  return `${HOSTED_VIDEOS_BASE_URL}/${encoded}`
}

/**
 * Returns true when a name looks like a hosted MP4 (or other progressive video).
 *
 * @param name - File name
 */
export const isHostedVideoName = (name: string): boolean => {
  const lower = name.toLowerCase()
  return (
    lower.endsWith('.mp4')
    || lower.endsWith('.m4v')
    || lower.endsWith('.webm')
    || lower.endsWith('.mov')
  )
}

/**
 * Normalizes a pasted catalog (one file name per line) into HostedVideoFile entries.
 *
 * @param text - Multiline paste from File Manager
 */
export const parseHostedCatalogText = (text: string): HostedVideoFile[] => {
  const seen = new Set<string>()
  const videos: HostedVideoFile[] = []

  for (const line of text.split(/\r?\n/)) {
    const name = line.trim()
    if (!name || name.startsWith('#') || seen.has(name)) {
      continue
    }
    if (!isHostedVideoName(name) && !name.includes('.')) {
      continue
    }
    seen.add(name)
    videos.push({ id: name, name })
  }

  return videos
}

/**
 * Builds the hosted catalog API URL.
 */
export const getHostedListUrl = (): string => {
  if (typeof window === 'undefined') {
    return '/.netlify/functions/hosted-list'
  }

  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8888/.netlify/functions/hosted-list'
  }

  return '/.netlify/functions/hosted-list'
}
