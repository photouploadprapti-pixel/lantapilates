import {
  clampDriveStreamRange,
  MAX_DRIVE_STREAM_CHUNK_BYTES,
} from './_shared/range-request'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
}

/**
 * Fetches Drive file metadata (size + mime) for HEAD / probe requests.
 *
 * @param fileId - Google Drive file id
 * @param apiKey - Google Drive API key
 */
const fetchDriveFileMeta = async (
  fileId: string,
  apiKey: string,
): Promise<{ size: number; mimeType: string }> => {
  const params = new URLSearchParams({
    fields: 'size,mimeType',
    key: apiKey,
    supportsAllDrives: 'true',
  })

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params}`,
  )
  const payload = (await response.json()) as {
    error?: { message?: string }
    size?: string
    mimeType?: string
  }

  if (!response.ok) {
    throw new Error(payload.error?.message ?? 'Drive metadata request failed')
  }

  const size = Number.parseInt(payload.size ?? '0', 10)
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('Drive file size is unavailable')
  }

  return {
    size,
    mimeType: payload.mimeType ?? 'video/mp2t',
  }
}

/**
 * Normalizes Drive media content type for browser / mpegts playback.
 *
 * @param contentType - Upstream Content-Type header
 */
const normalizeVideoContentType = (contentType: string): string => {
  const lower = contentType.toLowerCase()
  if (
    lower.includes('text/html') ||
    lower.includes('application/json') ||
    lower.includes('application/octet-stream')
  ) {
    return 'video/mp2t'
  }
  return contentType
}

/**
 * Proxies Google Drive media with clamped Range support for mpegts.js playback.
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

  const fileId = event.queryStringParameters?.id?.trim()
  if (!fileId) {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing file id' }),
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

  const clientRange = event.headers.range ?? event.headers.Range
  const upstreamRange = clampDriveStreamRange(clientRange)

  try {
    if (event.httpMethod === 'HEAD') {
      const meta = await fetchDriveFileMeta(fileId, apiKey)
      return {
        statusCode: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': normalizeVideoContentType(meta.mimeType),
          'Content-Length': String(meta.size),
          'Accept-Ranges': 'bytes',
        },
        body: '',
      }
    }

    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(apiKey)}`
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
      upstream.headers.get('content-type') ?? 'video/mp2t',
    )
    const contentRange = upstream.headers.get('content-range')

    return {
      statusCode: upstream.status === 200 ? 206 : upstream.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        ...(contentRange ? { 'Content-Range': contentRange } : {}),
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Drive stream failed'
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: message }),
    }
  }
}
