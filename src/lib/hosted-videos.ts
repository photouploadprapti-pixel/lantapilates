import hostedVideoNames from '../../shared/hosted-video-names.json'
import { isVideoFileName } from '@/lib/local-video-catalog'

/** Public base URL for Lanta workout MP4s on a2hosting. */
export const HOSTED_VIDEOS_BASE_URL = 'https://nrzmszcz.a2hosted.com/LantaVideos'

/**
 * Same-origin stream path that proxies a2hosting MP4s for the web app.
 */
export const HOSTED_STREAM_API_PATH = '/api/hosted-stream/'

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
 * Builds a playable URL for a hosted a2hosting MP4 file name.
 * Uses the same-origin proxy so the browser never talks to Google Drive.
 *
 * @param fileName - Exact catalog file name (may include spaces / &)
 */
export const getHostedVideoUrl = (fileName: string): string => {
  const encoded = encodeURIComponent(fileName.trim())
  return `${HOSTED_STREAM_API_PATH}?file=${encoded}`
}

/**
 * Builds the direct a2hosting HTTPS URL (for diagnostics / admin display).
 *
 * @param fileName - Exact file name on the server
 */
export const getDirectHostedVideoUrl = (fileName: string): string => {
  const encoded = encodeURIComponent(fileName.trim()).replace(/%2F/g, '/')
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
  if (!trimmed || isHostedVideoName(trimmed) || isVideoFileName(trimmed)) {
    return false
  }
  // Drive ids are opaque tokens without a video file extension.
  return !trimmed.includes('/') && !trimmed.includes('\\') && !trimmed.includes('.')
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
    return '/api/hosted-list/'
  }

  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8888/api/hosted-list/'
  }

  return '/api/hosted-list/'
}
