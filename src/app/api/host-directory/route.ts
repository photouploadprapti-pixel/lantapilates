import { getDirectHostedVideoUrl } from '@/lib/hosted-videos'

import {
  parseBearerToken,
  verifyAdminToken,
} from '../../../../netlify/functions/_shared/admin-auth'
import {
  DEFAULT_HOSTED_VIDEO_NAMES,
  getHostedVideoCatalog,
  rememberHostedVideo,
  renameHostedVideoReferences,
} from '../../../../netlify/functions/_shared/hosted-catalog'
import {
  isHostingFtpConfigured,
  listHostingVideos,
  renameHostingVideo,
  sanitizeVideoFileName,
  uploadHostingChunk,
} from '../../../../netlify/functions/_shared/hosting-ftp'
import { listHostedVideoNames } from '../../../../netlify/functions/_shared/list-hosted-videos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_CHUNK_BYTES = 3_500_000
const MAX_CHUNKS = 2000

type HostDirectoryVideo = {
  name: string
  url: string
  bytes: number | null
  modifiedAt: string | null
}

type JsonBody = {
  action?: string
  from?: string
  to?: string
}

/**
 * Builds a JSON response for the host directory API.
 *
 * @param status - HTTP status
 * @param body - Response payload
 */
const json = (status: number, body: unknown): Response =>
  Response.json(body, { status })

/**
 * Requires a valid admin bearer token.
 *
 * @param request - Incoming request
 */
const requireAdmin = (request: Request): Response | null => {
  try {
    const token = parseBearerToken(request.headers.get('authorization') ?? undefined)
    if (!verifyAdminToken(token)) {
      return json(401, { error: 'Unauthorized' })
    }
    return null
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Auth is not configured'
    return json(500, { error: message })
  }
}

/**
 * Builds a playable directory row for one file name.
 *
 * @param name - Hosted file name
 * @param bytes - Size in bytes, when FTP provided it
 * @param modifiedAt - ISO modified time, when known
 */
const toVideo = (
  name: string,
  bytes: number | null,
  modifiedAt: string | null,
): HostDirectoryVideo => ({
  name,
  url: getDirectHostedVideoUrl(name),
  bytes,
  modifiedAt,
})

/**
 * Merges the bundled catalog with the catalog saved in Supabase.
 */
const loadKnownNames = async (): Promise<string[]> => {
  const saved = await getHostedVideoCatalog()
  const names = new Set<string>(DEFAULT_HOSTED_VIDEO_NAMES)
  for (const video of saved) {
    names.add(video.name)
  }
  return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

/**
 * Lists the hosting folder. FTP is the live source; otherwise known file names.
 *
 * @param request - Authenticated GET
 */
export const GET = async (request: Request): Promise<Response> => {
  const denied = requireAdmin(request)
  if (denied) {
    return denied
  }

  const ftpConfigured = isHostingFtpConfigured()
  const baseUrl = 'https://nrzmszcz.a2hosted.com/LantaVideos'

  if (ftpConfigured) {
    try {
      const videos = await listHostingVideos()
      return json(200, {
        videos: videos.map((video) => toVideo(video.name, video.bytes, video.modifiedAt)),
        source: 'ftp',
        ftpConfigured: true,
        canManage: true,
        baseUrl,
      })
    } catch (error) {
      return fallbackListing(
        true,
        error instanceof Error ? error.message : 'Could not list the folder over FTP',
        baseUrl,
      )
    }
  }

  try {
    const names = await listHostedVideoNames()
    return json(200, {
      videos: names.map((name) => toVideo(name, null, null)),
      source: 'index',
      ftpConfigured: false,
      canManage: false,
      warning:
        'The folder index is public, but rename and upload still need FTP credentials.',
      baseUrl,
    })
  } catch (error) {
    const warning = error instanceof Error ? error.message : 'Could not list the hosting folder'
    return fallbackListing(false, warning, baseUrl)
  }
}

/**
 * Returns the saved catalog when the live folder cannot be listed.
 *
 * @param ftpConfigured - Whether FTP variables are present
 * @param warning - Why the live listing failed
 * @param baseUrl - Public video origin
 */
const fallbackListing = async (
  ftpConfigured: boolean,
  warning: string,
  baseUrl: string,
): Promise<Response> => {
  try {
    const names = await loadKnownNames()
    return json(200, {
      videos: names.map((name) => toVideo(name, null, null)),
      source: 'fallback',
      ftpConfigured,
      canManage: false,
      warning,
      baseUrl,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load the saved catalog'
    return json(500, { error: message, warning })
  }
}

/**
 * Reads a required integer header.
 *
 * @param request - Incoming request
 * @param name - Header name
 */
const readChunkHeader = (request: Request, name: string): number => {
  const value = Number(request.headers.get(name))
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Missing ${name}`)
  }
  return value
}

/**
 * Reads and checks the upload file name header.
 *
 * @param request - Incoming upload request
 */
const readUploadName = (request: Request): string => {
  const raw = request.headers.get('x-file-name')?.trim() ?? ''
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    decoded = raw
  }
  return sanitizeVideoFileName(decoded)
}

/**
 * Stores one upload chunk on the host. The last chunk updates the saved catalog.
 *
 * @param request - Raw octet-stream body
 */
const handleUpload = async (request: Request): Promise<Response> => {
  if (!isHostingFtpConfigured()) {
    return json(503, {
      error:
        'FTP is not configured. Add HOSTING_FTP_HOST, HOSTING_FTP_USER, '
        + 'HOSTING_FTP_PASSWORD, and HOSTING_FTP_REMOTE_DIR.',
    })
  }

  const fileName = readUploadName(request)
  const chunkIndex = readChunkHeader(request, 'x-chunk-index')
  const chunkTotal = readChunkHeader(request, 'x-chunk-total')
  if (chunkTotal < 1 || chunkTotal > MAX_CHUNKS || chunkIndex >= chunkTotal) {
    return json(400, { error: 'Invalid upload chunk' })
  }

  const chunk = Buffer.from(await request.arrayBuffer())
  if (chunk.length === 0 || chunk.length > MAX_CHUNK_BYTES) {
    return json(400, { error: 'Upload chunk must be between 1 byte and 3.5 MB' })
  }

  await uploadHostingChunk(fileName, chunkIndex, chunk)

  if (chunkIndex === chunkTotal - 1) {
    try {
      await rememberHostedVideo(fileName)
    } catch (error) {
      const warning = error instanceof Error ? error.message : 'Could not save the catalog'
      return json(200, { ok: true, fileName, warning })
    }
  }

  return json(200, { ok: true, fileName })
}

/**
 * Renames a host file and the playlists that reference it.
 *
 * @param body - JSON rename action
 */
const handleRename = async (body: JsonBody): Promise<Response> => {
  if (!isHostingFtpConfigured()) {
    return json(503, {
      error:
        'FTP is not configured. Add HOSTING_FTP_HOST, HOSTING_FTP_USER, '
        + 'HOSTING_FTP_PASSWORD, and HOSTING_FTP_REMOTE_DIR.',
    })
  }

  const from = sanitizeVideoFileName(body.from ?? '')
  const to = sanitizeVideoFileName(body.to ?? '')
  await renameHostingVideo(from, to)

  try {
    await renameHostedVideoReferences(from, to)
  } catch (error) {
    const warning = error instanceof Error ? error.message : 'Could not update playlists'
    return json(200, {
      ok: true,
      from,
      to,
      warning: `Renamed the file on the host. Playlist update failed: ${warning}`,
    })
  }

  return json(200, { ok: true, from, to })
}

/**
 * Renames a hosted video or accepts one upload chunk.
 *
 * @param request - Authenticated POST
 */
export const POST = async (request: Request): Promise<Response> => {
  const denied = requireAdmin(request)
  if (denied) {
    return denied
  }

  try {
    const contentType = request.headers.get('content-type') ?? ''
    if (contentType.includes('application/octet-stream')) {
      return await handleUpload(request)
    }

    const body = (await request.json()) as JsonBody
    if (body.action === 'rename') {
      return await handleRename(body)
    }

    return json(400, { error: 'Unknown action' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed'
    return json(400, { error: message })
  }
}
