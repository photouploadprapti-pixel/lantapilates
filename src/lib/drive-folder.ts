/**
 * Parses a Google Drive folder id from a share URL or raw id.
 *
 * @param input - Folder URL or id
 */
export const parseDriveFolderId = (input: string): string | null => {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed) && !trimmed.includes('/')) {
    return trimmed
  }

  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (folderMatch?.[1]) {
    return folderMatch[1]
  }

  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (idMatch?.[1]) {
    return idMatch[1]
  }

  return null
}

export const DEFAULT_DRIVE_FOLDER_URL =
  'https://drive.google.com/drive/folders/1wCKXxGERf3rZmvwrpBlJqSY63S9cJoBh?usp=sharing'

export const DEFAULT_DRIVE_FOLDER_ID = '1wCKXxGERf3rZmvwrpBlJqSY63S9cJoBh'

export type DriveVideoFile = {
  id: string
  name: string
  mimeType?: string
  size?: string
}

/**
 * Builds a same-origin Drive stream URL for mpegts.js / HTML5 playback.
 *
 * @param fileId - Google Drive file id
 */
export const getDriveProxyStreamUrl = (fileId: string): string => {
  if (typeof window === 'undefined') {
    return `/.netlify/functions/drive-stream?id=${encodeURIComponent(fileId)}`
  }

  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://localhost:8888/.netlify/functions/drive-stream?id=${encodeURIComponent(fileId)}`
  }

  return `/.netlify/functions/drive-stream?id=${encodeURIComponent(fileId)}`
}

/**
 * Builds the Drive list API URL (public Netlify function).
 *
 * @param folderId - Optional folder id override
 */
export const getDriveListUrl = (folderId?: string): string => {
  const query = folderId ? `?folderId=${encodeURIComponent(folderId)}` : ''

  if (typeof window === 'undefined') {
    return `/.netlify/functions/drive-list${query}`
  }

  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://localhost:8888/.netlify/functions/drive-list${query}`
  }

  return `/.netlify/functions/drive-list${query}`
}

/**
 * Returns true when a Drive file name looks like a video we can play.
 *
 * @param name - File name
 */
export const isDriveVideoName = (name: string): boolean => {
  const lower = name.toLowerCase()
  return (
    lower.endsWith('.ts') ||
    lower.endsWith('.mts') ||
    lower.endsWith('.m2ts') ||
    lower.endsWith('.mp4') ||
    lower.endsWith('.m4v') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.mkv') ||
    lower.endsWith('.mov')
  )
}
