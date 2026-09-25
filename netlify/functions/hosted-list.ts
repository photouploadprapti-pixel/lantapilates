import {
  DEFAULT_HOSTED_VIDEO_NAMES,
  getHostedVideoCatalog,
  toHostedCatalog,
  type HostedVideoFile,
} from './_shared/hosted-catalog'
import { listHostedVideoNames } from './_shared/list-hosted-videos'

/**
 * Keeps every known file name from the bundled list and the saved catalog.
 *
 * @param bundled - Names shipped with the app
 * @param saved - Names stored in Supabase
 */
const mergeHostedVideos = (
  bundled: HostedVideoFile[],
  saved: HostedVideoFile[],
): HostedVideoFile[] => {
  const byName = new Map<string, HostedVideoFile>()
  for (const video of [...bundled, ...saved]) {
    byName.set(video.name, video)
  }
  return [...byName.values()]
}

const jsonResponse = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(body),
})

/**
 * Lists hosted MP4 catalog for the admin dashboard (replaces drive-list).
 */
export const handler = async (event: { httpMethod: string }) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    }
  }

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  try {
    try {
      const names = await listHostedVideoNames()
      return jsonResponse(200, {
        videos: toHostedCatalog(names),
        source: 'host',
        baseUrl: 'https://nrzmszcz.a2hosted.com/LantaVideos',
      })
    } catch (listError) {
      const saved = await getHostedVideoCatalog()
      const videos = mergeHostedVideos(toHostedCatalog(DEFAULT_HOSTED_VIDEO_NAMES), saved)
      const warning = listError instanceof Error
        ? listError.message
        : 'Could not list the hosting folder'
      return jsonResponse(200, {
        videos,
        source: 'fallback',
        warning,
        baseUrl: 'https://nrzmszcz.a2hosted.com/LantaVideos',
      })
    }
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Could not load hosted videos',
    })
  }
}
