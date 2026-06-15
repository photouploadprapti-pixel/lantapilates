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
 * Builds a same-origin thumbnail URL proxied through the Next.js API.
 *
 * @param fileId - Google Drive file id
 */
export const getProxiedDriveThumbnailUrl = (fileId: string): string =>
  `/api/video-thumbnail/${fileId}`

/**
 * Builds a same-origin stream URL proxied through the Next.js API.
 *
 * @param fileId - Google Drive file id
 */
export const getProxiedDriveStreamUrl = (fileId: string): string =>
  `/api/video-stream/${fileId}`

/**
 * Resolves the embed URL for iframe-based playback (Google Drive).
 *
 * @param source - Video source configuration
 */
export const getVideoEmbedUrl = (source: VideoSource): string | null => {
  if (source.type === 'google-drive') {
    return getGoogleDrivePreviewUrl(source.fileId)
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
