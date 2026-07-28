import { getHostedVideoCatalog } from './_shared/hosted-catalog'

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
    const videos = await getHostedVideoCatalog()
    return jsonResponse(200, {
      videos,
      baseUrl: 'https://nrzmszcz.a2hosted.com/LantaVideos',
    })
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Could not load hosted videos',
    })
  }
}
