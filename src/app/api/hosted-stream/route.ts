import { HOSTED_VIDEOS_BASE_URL } from '@/lib/hosted-videos'

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
 * Builds the upstream a2hosting URL for a catalog file name.
 *
 * @param fileName - Exact hosted file name
 */
const buildUpstreamUrl = (fileName: string): string => {
  const encoded = encodeURIComponent(fileName.trim()).replace(/%2F/g, '/')
  return `${HOSTED_VIDEOS_BASE_URL}/${encoded}`
}

/**
 * Returns true when the upstream response looks like playable media (not a bot page).
 *
 * @param contentType - Upstream Content-Type
 * @param status - HTTP status
 */
const isPlayableMediaResponse = (contentType: string, status: number): boolean => {
  const lower = contentType.toLowerCase()
  if (lower.includes('text/html') || lower.includes('application/json')) {
    return false
  }
  if (status === 206 || status === 200) {
    return (
      lower.includes('video/')
      || lower.includes('audio/')
      || lower.includes('application/octet-stream')
      || lower.includes('mpeg')
      || lower === ''
    )
  }
  return false
}

/**
 * Streams a hosted catalog MP4 from a2hosting (never Google Drive).
 *
 * @param request - Incoming stream request (`?file=…`)
 */
export const GET = async (request: Request): Promise<Response> => {
  const fileName = new URL(request.url).searchParams.get('file')?.trim()
  if (!fileName) {
    return Response.json({ error: 'Missing file name' }, { status: 400, headers: CORS_HEADERS })
  }

  const upstreamUrl = buildUpstreamUrl(fileName)
  const range = request.headers.get('range')

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        ...(range ? { Range: range } : {}),
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
          + '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: '*/*',
        Referer: 'https://lantapilates.vercel.app/',
      },
      redirect: 'follow',
    })

    const contentType = upstream.headers.get('content-type') ?? ''

    if (!isPlayableMediaResponse(contentType, upstream.status)) {
      const snippet = (await upstream.text()).slice(0, 180)
      return Response.json(
        {
          error:
            'a2hosting did not return a video file. Imunify bot protection is likely '
            + 'blocking /LantaVideos — disable the WebShield splash for that folder.',
          upstreamStatus: upstream.status,
          contentType,
          upstreamUrl,
          snippet,
        },
        { status: 502, headers: CORS_HEADERS },
      )
    }

    const headers = new Headers(CORS_HEADERS)
    headers.set('Content-Type', contentType || 'video/mp4')
    headers.set('Accept-Ranges', upstream.headers.get('accept-ranges') ?? 'bytes')
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
