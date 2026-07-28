import hostedVideoNames from '../../shared/hosted-video-names.json'

/** Public base URL for Lanta workout MP4s on a2hosting. */
export const HOSTED_VIDEOS_BASE_URL = 'https://nrzmszcz.a2hosted.com/LantaVideos'

export type HostedVideoFile = {
  /** Same as file name — used as the assignment id. */
  id: string
  name: string
}

/**
 * Full hosted catalog (FTP / File Manager names). Directory listing is disabled on the host.
 */
export const DEFAULT_HOSTED_VIDEO_CATALOG: HostedVideoFile[] = (
  hostedVideoNames as string[]
).map((name) => ({ id: name, name }))

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
 * Returns true when a name looks like a hosted progressive video file.
 *
 * @param name - File name or legacy Drive id
 */
export const isHostedVideoName = (name: string): boolean => {
  const lower = name.trim().toLowerCase()
  return (
    lower.endsWith('.mp4')
    || lower.endsWith('.m4v')
    || lower.endsWith('.webm')
    || lower.endsWith('.mov')
  )
}

/**
 * Returns true when a stored id looks like a legacy Google Drive file id.
 *
 * @param name - Stored assignment value
 */
export const isLegacyDriveVideoId = (name: string): boolean => {
  const trimmed = name.trim()
  if (!trimmed || isHostedVideoName(trimmed)) {
    return false
  }
  // Drive ids are opaque tokens without a video extension.
  return !trimmed.includes('/') && !trimmed.includes('\\')
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
    if (!isHostedVideoName(name)) {
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
