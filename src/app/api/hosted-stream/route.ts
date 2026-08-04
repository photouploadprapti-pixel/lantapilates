import { DEFAULT_DRIVE_FOLDER_ID } from '../../../../netlify/functions/_shared/drive'
import { clampDriveStreamRange } from '../../../../netlify/functions/_shared/range-request'
import { resolveDriveVideoByName } from '../../../../netlify/functions/_shared/resolve-drive-video'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
}

/**
 * Picks a Content-Type for Drive media based on upstream headers / file name.
 *
 * @param contentType - Upstream Content-Type
 * @param fileName - Resolved Drive file name
 */
const normalizeVideoContentType = (contentType: string, fileName: string): string => {
  const lower = contentType.toLowerCase()
  if (lower.includes('video/') && !lower.includes('text/html')) {
    return contentType
  }
  if (/\.(mp4|m4v)$/i.test(fileName)) {
    return 'video/mp4'
  }
  if (/\.webm$/i.test(fileName)) {
    return 'video/webm'
  }
  return 'video/mp2t'
}

/**
 * Streams a hosted catalog video via Google Drive (bypasses a2hosting bot shield).
 *
 * @param request - Incoming stream request (`?file=…`)
 */
export const GET = async (request: Request): Promise<Response> => {
  const fileName = new URL(request.url).searchParams.get('file')?.trim()
  if (!fileName) {
    return Response.json({ error: 'Missing file name' }, { status: 400, headers: CORS_HEADERS })
  }

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY?.trim()
  if (!apiKey) {
    return Response.json(
      { error: 'Missing GOOGLE_DRIVE_API_KEY' },
      { status: 500, headers: CORS_HEADERS },
    )
  }

  try {
    const folderId = process.env.DRIVE_FOLDER_ID?.trim() || DEFAULT_DRIVE_FOLDER_ID
    const resolved = await resolveDriveVideoByName(fileName, apiKey, folderId)
    if (!resolved) {
      return Response.json(
        { error: `No Drive video found for ${fileName}` },
        { status: 404, headers: CORS_HEADERS },
      )
    }

    const upstreamRange = clampDriveStreamRange(request.headers.get('range') ?? undefined)
    const downloadUrl =
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(resolved.id)}`
      + `?alt=media&key=${encodeURIComponent(apiKey)}`

    const upstream = await fetch(downloadUrl, {
      headers: { Range: upstreamRange },
      redirect: 'follow',
    })

    if (!upstream.ok && upstream.status !== 206) {
      const details = (await upstream.text()).slice(0, 200)
      return Response.json(
        { error: 'Drive download failed', details },
        { status: upstream.status, headers: CORS_HEADERS },
      )
    }

    const headers = new Headers(CORS_HEADERS)
    headers.set(
      'Content-Type',
      normalizeVideoContentType(upstream.headers.get('content-type') ?? '', resolved.name),
    )
    headers.set('Accept-Ranges', 'bytes')
    headers.set('Cache-Control', 'public, max-age=3600')

    const contentLength = upstream.headers.get('content-length')
    if (contentLength) {
      headers.set('Content-Length', contentLength)
    }
    const contentRange = upstream.headers.get('content-range')
    if (contentRange) {
      headers.set('Content-Range', contentRange)
    }

    if (request.method === 'HEAD') {
      return new Response(null, { status: upstream.status, headers })
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Hosted stream failed'
    return Response.json({ error: message }, { status: 500, headers: CORS_HEADERS })
  }
}

/**
 * CORS preflight for hosted video streaming.
 */
export const OPTIONS = async (): Promise<Response> =>
  new Response(null, { status: 204, headers: CORS_HEADERS })

/**
 * HEAD uses the same stream resolution path as GET.
 *
 * @param request - Incoming HEAD request
 */
export const HEAD = async (request: Request): Promise<Response> => GET(request)
