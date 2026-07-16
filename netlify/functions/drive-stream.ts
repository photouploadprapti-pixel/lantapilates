const MAX_BUFFER_BYTES = 5.5 * 1024 * 1024

/**
 * Proxies Google Drive media with Range support for mpegts.js (chunked, CORS-safe).
 * Full-file downloads over the Netlify limit are rejected — clients must use Range.
 */
export const handler = async (event: {
  httpMethod: string
  queryStringParameters?: Record<string, string | undefined> | null
  headers: Record<string, string | undefined>
}) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
      },
      body: '',
    }
  }

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  const fileId = event.queryStringParameters?.id?.trim()
  if (!fileId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Missing file id' }),
    }
  }

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY?.trim()
  const range = event.headers.range ?? event.headers.Range

  try {
    const downloadUrl = apiKey
      ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(apiKey)}`
      : `https://drive.google.com/uc?export=download&confirm=t&id=${encodeURIComponent(fileId)}`

    const upstreamHeaders: Record<string, string> = {}
    if (range) {
      upstreamHeaders.Range = range
    } else {
      // Cap first probe request so serverless response stays within platform limits.
      upstreamHeaders.Range = `bytes=0-${Math.floor(MAX_BUFFER_BYTES) - 1}`
    }

    const upstream = await fetch(downloadUrl, {
      headers: upstreamHeaders,
      redirect: 'follow',
    })

    if (!upstream.ok && upstream.status !== 206) {
      const text = await upstream.text()
      return {
        statusCode: upstream.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          error: 'Drive download failed',
          details: text.slice(0, 200),
        }),
      }
    }

    const contentType = upstream.headers.get('content-type') ?? 'video/mp2t'
    const contentLength = upstream.headers.get('content-length')
    const contentRange = upstream.headers.get('content-range')
    const acceptRanges = upstream.headers.get('accept-ranges') ?? 'bytes'

    if (contentLength && Number(contentLength) > MAX_BUFFER_BYTES) {
      return {
        statusCode: 413,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          error: 'Response too large. Use Range requests for Drive video streaming.',
        }),
      }
    }

    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType.includes('text/html') ? 'video/mp2t' : contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
      'Accept-Ranges': acceptRanges,
      'Cache-Control': 'public, max-age=3600',
    }

    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength
    }
    if (contentRange) {
      responseHeaders['Content-Range'] = contentRange
    }

    if (event.httpMethod === 'HEAD') {
      return {
        statusCode: upstream.status === 200 && !range ? 206 : upstream.status,
        headers: responseHeaders,
        body: '',
      }
    }

    const buffer = Buffer.from(await upstream.arrayBuffer())

    return {
      statusCode: upstream.status === 200 && !range ? 206 : upstream.status,
      headers: {
        ...responseHeaders,
        'Content-Length': String(buffer.length),
        ...(contentRange
          ? { 'Content-Range': contentRange }
          : {
              'Content-Range': `bytes 0-${buffer.length - 1}/${buffer.length}`,
            }),
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Drive stream failed'
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: message }),
    }
  }
}
