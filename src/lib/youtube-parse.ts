export type ParsedYouTubeInput =
  | { kind: 'video'; videoId: string }
  | { kind: 'playlist'; playlistId: string }
  | { kind: 'invalid' }

/**
 * Parses a YouTube video or playlist URL / id into structured input.
 * @param input - Raw URL or id pasted by admin
 */
export const parseYouTubeInput = (input: string): ParsedYouTubeInput => {
  const trimmed = input.trim()
  if (!trimmed) {
    return { kind: 'invalid' }
  }

  if (/^PL[\w-]+$/i.test(trimmed)) {
    return { kind: 'playlist', playlistId: trimmed }
  }

  if (/^[\w-]{11}$/.test(trimmed)) {
    return { kind: 'video', videoId: trimmed }
  }

  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)

    if (url.hostname.includes('youtu.be')) {
      const videoId = url.pathname.replace('/', '')
      if (videoId) {
        return { kind: 'video', videoId }
      }
    }

    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtube-nocookie.com')) {
      const listId = url.searchParams.get('list')
      if (listId) {
        return { kind: 'playlist', playlistId: listId }
      }

      const videoId = url.searchParams.get('v')
      if (videoId) {
        return { kind: 'video', videoId }
      }

      const embedMatch = url.pathname.match(/\/embed\/([\w-]{11})/)
      if (embedMatch?.[1]) {
        return { kind: 'video', videoId: embedMatch[1] }
      }

      const shortsMatch = url.pathname.match(/\/shorts\/([\w-]{11})/)
      if (shortsMatch?.[1]) {
        return { kind: 'video', videoId: shortsMatch[1] }
      }
    }
  } catch {
    return { kind: 'invalid' }
  }

  return { kind: 'invalid' }
}

/**
 * Fetches playlist video ids from the public YouTube RSS feed.
 * @param playlistId - YouTube playlist id
 */
export const fetchPlaylistVideoIds = async (playlistId: string): Promise<string[]> => {
  const response = await fetch(
    `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`,
  )

  if (!response.ok) {
    throw new Error('Could not load playlist from YouTube')
  }

  const xml = await response.text()
  const matches = [...xml.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)]
  const ids = matches.map((match) => match[1]).filter(Boolean)

  return [...new Set(ids)]
}

/**
 * Fetches a video title via YouTube oEmbed (best effort).
 * @param videoId - YouTube video id
 */
export const fetchVideoTitle = async (videoId: string): Promise<string | null> => {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
    )
    if (!response.ok) {
      return null
    }
    const data = (await response.json()) as { title?: string }
    return data.title ?? null
  } catch {
    return null
  }
}
