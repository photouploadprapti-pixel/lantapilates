/**
 * Shared Google Drive helpers for Netlify functions.
 */

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

/**
 * Returns true when a Drive file name looks like a playable video.
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

export const DEFAULT_DRIVE_FOLDER_ID = '1wCKXxGERf3rZmvwrpBlJqSY63S9cJoBh'
