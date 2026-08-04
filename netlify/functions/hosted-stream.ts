import {
  clampDriveStreamRange,
  MAX_DRIVE_STREAM_CHUNK_BYTES,
} from './_shared/range-request'
import { resolveDriveVideoByName } from './_shared/resolve-drive-video'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
}

/**
 * Normalizes Drive media content type for browser / mpegts playback.
 *
 * @param contentType - Upstream Content-Type header
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
  if (/\.(webm)$/i.test(fileName)) {
    return 'video/webm'
  }
  return 'video/mp2t'
}

/**
 * Proxies hosted catalog videos from Google Drive (a2hosting currently blocks bots).
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

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY?.trim()
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing GOOGLE_DRIVE_API_KEY' }),
    }
  }

  try {
    const resolved = await resolveDriveVideoByName(fileName, apiKey)
    if (!resolved) {
      return {
        statusCode: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `No Drive video found for ${fileName}` }),
      }
    }

    const clientRange = event.headers.range ?? event.headers.Range
    const upstreamRange = clampDriveStreamRange(clientRange)
    const downloadUrl =
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(resolved.id)}`
      + `?alt=media&key=${encodeURIComponent(apiKey)}`

    const upstream = await fetch(downloadUrl, {
      headers: { Range: upstreamRange },
      redirect: 'follow',
    })

    if (!upstream.ok && upstream.status !== 206) {
      const text = await upstream.text()
      return {
        statusCode: upstream.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Drive download failed',
          details: text.slice(0, 200),
        }),
      }
    }

    const buffer = Buffer.from(await upstream.arrayBuffer())
    if (buffer.length > MAX_DRIVE_STREAM_CHUNK_BYTES) {
      return {
        statusCode: 413,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: `Chunk exceeded ${MAX_DRIVE_STREAM_CHUNK_BYTES} bytes. Use smaller Range requests.`,
        }),
      }
    }

    const contentType = normalizeVideoContentType(
      upstream.headers.get('content-type') ?? '',
      resolved.name,
    )
    const contentRange = upstream.headers.get('content-range')

    return {
      statusCode: upstream.status === 200 && contentRange ? 206 : upstream.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        ...(contentRange ? { 'Content-Range': contentRange } : {}),
      },
      body: event.httpMethod === 'HEAD' ? '' : buffer.toString('base64'),
      isBase64Encoded: event.httpMethod !== 'HEAD',
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
