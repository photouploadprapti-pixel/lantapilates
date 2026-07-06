import type { VideoSource } from '@/types/workout-video'

/**
 * Builds a Google Drive embed URL for in-app video preview playback.
 *
 * @param fileId - Google Drive file id
 */
export const getGoogleDrivePreviewUrl = (fileId: string): string =>
  `https://drive.google.com/file/d/${fileId}/preview`

/**
 * Builds a Google Drive thumbnail URL for list previews (direct upstream).
 *
 * @param fileId - Google Drive file id
 * @param width - Thumbnail width in pixels
 */
export const getGoogleDriveThumbnailUrl = (fileId: string, width = 400): string =>
  `https://lh3.googleusercontent.com/d/${fileId}=w${width}`

/**
 * Builds a same-origin thumbnail URL proxied through the Next.js API (web dev only).
 * Static export uses direct Google thumbnail URLs instead.
 *
 * @param fileId - Google Drive file id
 */
export const getProxiedDriveThumbnailUrl = (fileId: string): string =>
  getGoogleDriveThumbnailUrl(fileId)

/**
 * Builds a stream URL for Google Drive files on web builds without a server proxy.
 *
 * @param fileId - Google Drive file id
 */
export const getProxiedDriveStreamUrl = (fileId: string): string =>
  `https://drive.google.com/uc?export=download&id=${fileId}`

/**
 * Builds YouTube embed playerVars for a minimal in-app experience.
 * @param options - Optional playlist id for playlist playback
 */
export const buildYouTubeEmbedParams = (
  options?: { playlistId?: string },
): Record<string, number | string> => {
  const params: Record<string, number | string> = {
    autoplay: 1,
    modestbranding: 1,
    rel: 0,
    iv_load_policy: 3,
    playsinline: 1,
    controls: 1,
    fs: 1,
    disablekb: 0,
    enablejsapi: 1,
    origin: typeof window !== 'undefined' ? window.location.origin : '',
  }

  if (options?.playlistId) {
    params.listType = 'playlist'
    params.list = options.playlistId
  }

  return params
}

const buildYouTubeSearchParams = (extra?: Record<string, string>): URLSearchParams => {
  const params = new URLSearchParams({
    autoplay: '0',
    modestbranding: '1',
    rel: '0',
    iv_load_policy: '3',
    cc_load_policy: '3',
    playsinline: '1',
    controls: '0',
    disablekb: '1',
    enablejsapi: '1',
    fs: '0',
    autohide: '1',
    ...extra,
  })

  return params
}

/**
 * Builds a YouTube embed URL (standard domain for best browser compatibility).
 *
 * @param videoId - YouTube video id
 */
export const getYouTubeEmbedUrl = (videoId: string): string => {
  const params = buildYouTubeSearchParams()
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}

/**
 * Builds a YouTube playlist embed URL.
 *
 * @param playlistId - YouTube playlist id
 */
export const getYouTubePlaylistEmbedUrl = (playlistId: string): string => {
  const params = buildYouTubeSearchParams({ list: playlistId })
  return `https://www.youtube.com/embed/videoseries?${params.toString()}`
}

/**
 * Builds a YouTube thumbnail URL for list previews.
 *
 * @param videoId - YouTube video id
 */
export const getYouTubeThumbnailUrl = (videoId: string): string =>
  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

/**
 * Resolves the embed URL for iframe-based playback (Google Drive).
 *
 * @param source - Video source configuration
 */
export const getVideoEmbedUrl = (source: VideoSource): string | null => {
  if (source.type === 'google-drive') {
    return getGoogleDrivePreviewUrl(source.fileId)
  }
  if (source.type === 'youtube') {
    if (source.playlistId) {
      return getYouTubePlaylistEmbedUrl(source.playlistId)
    }
    if (source.videoId) {
      return getYouTubeEmbedUrl(source.videoId)
    }
  }
  return null
}

/**
 * Resolves a thumbnail URL for video list items.
 *
 * @param source - Video source configuration
 */
export const getVideoThumbnailUrl = (source: VideoSource): string | null => {
  if (source.type === 'google-drive') {
    return getProxiedDriveThumbnailUrl(source.fileId)
  }
  if (source.type === 'youtube' && source.videoId) {
    return getYouTubeThumbnailUrl(source.videoId)
  }
  return null
}

/**
 * Resolves a stream URL for native `<video>` playback.
 *
 * @param source - Video source configuration
 */
export const getVideoStreamUrl = (source: VideoSource): string | null => {
  if (source.type === 'google-drive') {
    return getProxiedDriveStreamUrl(source.fileId)
  }
  if (source.type === 'local') {
    return source.localPath
  }
  return null
}
