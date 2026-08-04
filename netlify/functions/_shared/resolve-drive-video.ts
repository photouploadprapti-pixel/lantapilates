import { DEFAULT_DRIVE_FOLDER_ID } from './drive'

type DriveFileHit = {
  id: string
  name: string
  mimeType?: string
  size?: string
}

type DriveListResponse = {
  files?: DriveFileHit[]
  error?: { message?: string }
}

const nameCache = new Map<string, { id: string; name: string; expiresAt: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000

/**
 * Builds candidate Drive file names for a hosted catalog entry.
 *
 * @param fileName - Assigned hosted file name (usually `.mp4`)
 */
export const getDriveVideoNameCandidates = (fileName: string): string[] => {
  const trimmed = fileName.trim()
  if (!trimmed) {
    return []
  }

  const base = trimmed.replace(/\.(mp4|m4v|webm|mov|ts|mts|m2ts)$/i, '')
  const candidates = [
    trimmed,
    `${base}.ts`,
    `${base}.mp4`,
    `${base}.m4v`,
    `${base}.webm`,
    `${base}.mov`,
  ]

  return [...new Set(candidates.filter(Boolean))]
}

/**
 * Escapes a value for use inside a Drive `name = '…'` query.
 *
 * @param value - Raw file name
 */
const escapeDriveQueryValue = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

/**
 * Resolves a hosted catalog file name to a Google Drive file id in the videos folder.
 *
 * @param fileName - Hosted assignment name
 * @param apiKey - Google Drive API key
 * @param folderId - Optional Drive folder override
 */
export const resolveDriveVideoByName = async (
  fileName: string,
  apiKey: string,
  folderId = process.env.DRIVE_FOLDER_ID?.trim() || DEFAULT_DRIVE_FOLDER_ID,
): Promise<{ id: string; name: string } | null> => {
  const cacheKey = `${folderId}:${fileName.trim().toLowerCase()}`
  const cached = nameCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return { id: cached.id, name: cached.name }
  }

  for (const candidate of getDriveVideoNameCandidates(fileName)) {
    const query =
      `'${folderId}' in parents and name = '${escapeDriveQueryValue(candidate)}' and trashed = false`
    const params = new URLSearchParams({
      q: query,
      pageSize: '1',
      fields: 'files(id,name,mimeType,size)',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      key: apiKey,
    })

    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`)
    const payload = (await response.json()) as DriveListResponse

    if (!response.ok) {
      throw new Error(payload.error?.message ?? 'Drive file lookup failed')
    }

    const hit = payload.files?.[0]
    if (hit?.id) {
      nameCache.set(cacheKey, {
        id: hit.id,
        name: hit.name,
        expiresAt: Date.now() + CACHE_TTL_MS,
      })
      return { id: hit.id, name: hit.name }
    }
  }

  return null
}
