const HOSTED_VIDEOS_BASE_URL = 'https://nrzmszcz.a2hosted.com/LantaVideos'

const CORS_HEADERS = {
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
 * Returns true when the upstream response looks like playable media.
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
 * Proxies hosted catalog MP4s from a2hosting only (no Google Drive).
 */
export const handler = async (event: {
  httpMethod: string
  queryStringParameters?: Record<string, string | undefined> | null
  headers: Record<string, string | undefined>
}) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    }
  }

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
    return {
      statusCode: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  const fileName = event.queryStringParameters?.file?.trim()
  if (!fileName) {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing file name' }),
    }
  }

  const upstreamUrl = buildUpstreamUrl(fileName)
  const range = event.headers.range ?? event.headers.Range

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
      return {
        statusCode: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error:
            'a2hosting did not return a video file. Imunify bot protection is likely '
            + 'blocking /LantaVideos — disable the WebShield splash for that folder.',
          upstreamStatus: upstream.status,
          contentType,
          upstreamUrl,
          snippet,
        }),
      }
    }

    if (event.httpMethod === 'HEAD') {
      return {
        statusCode: upstream.status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': contentType || 'video/mp4',
          'Accept-Ranges': upstream.headers.get('accept-ranges') ?? 'bytes',
          ...(upstream.headers.get('content-length')
            ? { 'Content-Length': upstream.headers.get('content-length')! }
            : {}),
          ...(upstream.headers.get('content-range')
            ? { 'Content-Range': upstream.headers.get('content-range')! }
            : {}),
        },
        body: '',
      }
    }

    const buffer = Buffer.from(await upstream.arrayBuffer())
    const contentRange = upstream.headers.get('content-range')

    return {
      statusCode: upstream.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': contentType || 'video/mp4',
        'Content-Length': String(buffer.length),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        ...(contentRange ? { 'Content-Range': contentRange } : {}),
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Hosted stream failed'
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: message }),
    }
  }
}
