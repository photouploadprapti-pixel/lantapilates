import { NextResponse } from 'next/server'

import { resolveGoogleDriveStreamUrl } from '@/lib/google-drive-stream'

type RouteContext = {
  params: Promise<{ fileId: string }>
}

const PASSTHROUGH_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
] as const

/**
 * Proxies Google Drive video bytes for native `<video>` playback with seeking support.
 */
export const GET = async (request: Request, context: RouteContext) => {
  const { fileId } = await context.params

  if (!fileId || fileId.length < 10) {
    return NextResponse.json({ error: 'Invalid file id' }, { status: 400 })
  }

  try {
    const streamUrl = await resolveGoogleDriveStreamUrl(fileId)
    const range = request.headers.get('range')
    const upstreamHeaders: HeadersInit = {}

    if (range) {
      upstreamHeaders.Range = range
    }

    const upstream = await fetch(streamUrl, {
      headers: upstreamHeaders,
      redirect: 'follow',
    })

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json({ error: 'Video stream unavailable' }, { status: upstream.status })
    }

    const responseHeaders = new Headers()

    for (const header of PASSTHROUGH_HEADERS) {
      const value = upstream.headers.get(header)
      if (value) responseHeaders.set(header, value)
    }

    responseHeaders.set('Accept-Ranges', 'bytes')
    responseHeaders.set('Cache-Control', 'public, max-age=3600')

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load video stream' }, { status: 500 })
  }
}
