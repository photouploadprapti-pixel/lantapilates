import { NextResponse } from 'next/server'

type RouteContext = {
  params: Promise<{ fileId: string }>
}

const THUMBNAIL_WIDTH = 400

/**
 * Fetches a Google Drive video thumbnail from upstream sources.
 *
 * @param fileId - Google Drive file id
 */
const fetchDriveThumbnail = async (fileId: string): Promise<Response | null> => {
  const sources = [
    `https://lh3.googleusercontent.com/d/${fileId}=w${THUMBNAIL_WIDTH}`,
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w${THUMBNAIL_WIDTH}`,
  ]

  for (const url of sources) {
    const response = await fetch(url, { redirect: 'follow' })
    const contentType = response.headers.get('content-type') ?? ''

    if (response.ok && contentType.includes('image')) {
      return response
    }
  }

  return null
}

/**
 * Proxies Google Drive video thumbnails for same-origin `<img>` loading.
 */
export const GET = async (_request: Request, context: RouteContext) => {
  const { fileId } = await context.params

  if (!fileId || fileId.length < 10) {
    return NextResponse.json({ error: 'Invalid file id' }, { status: 400 })
  }

  const upstream = await fetchDriveThumbnail(fileId)

  if (!upstream) {
    return NextResponse.json({ error: 'Thumbnail not found' }, { status: 404 })
  }

  const bytes = await upstream.arrayBuffer()
  const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  })
}
