export type ParsedYouTubeInput =
  | { kind: 'video'; videoId: string }
  | { kind: 'playlist'; playlistId: string }
  | { kind: 'invalid' }

const YOUTUBE_USER_AGENT =
  'Mozilla/5.0 (compatible; LantaPilates/1.0; +https://lantapilates.netlify.app)'

const PLAYLIST_ID_PATTERN = /^(PL|OLAK|RD|UU|FL|VL)[\w-]+$/i

/**
 * Escapes a string for safe use inside a RegExp.
 * @param value - Raw playlist id
 */
const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Parses a YouTube video or playlist URL / id into structured input.
 * @param input - Raw URL or id pasted by admin
 */
export const parseYouTubeInput = (input: string): ParsedYouTubeInput => {
  const trimmed = input.trim()
  if (!trimmed) {
    return { kind: 'invalid' }
  }

  if (PLAYLIST_ID_PATTERN.test(trimmed)) {
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
      const videoId = url.searchParams.get('v')

      if (url.pathname.includes('/playlist') && listId) {
        return { kind: 'playlist', playlistId: listId }
      }

      if (videoId) {
        return { kind: 'video', videoId }
      }

      if (listId) {
        return { kind: 'playlist', playlistId: listId }
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
 * Loads playlist video ids by scraping the public playlist page.
 * @param playlistId - YouTube playlist id
 */
export const fetchPlaylistVideoIds = async (playlistId: string): Promise<string[]> => {
  const response = await fetch(
    `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`,
    {
      headers: {
        'User-Agent': YOUTUBE_USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
      },
    },
  )

  if (!response.ok) {
    throw new Error('Could not load playlist from YouTube')
  }

  const html = await response.text()
  const pattern = new RegExp(
    `"videoId":"([\\w-]{11})","playlistId":"${escapeRegex(playlistId)}","index":(\\d+)`,
    'g',
  )

  const entries: Array<{ index: number; videoId: string }> = []
  for (const match of html.matchAll(pattern)) {
    const videoId = match[1]
    const index = Number(match[2])
    if (videoId && Number.isFinite(index)) {
      entries.push({ index, videoId })
    }
  }

  if (entries.length === 0) {
    throw new Error('No videos found in that playlist')
  }

  entries.sort((left, right) => left.index - right.index)

  const seen = new Set<string>()
  const ids: string[] = []
  for (const entry of entries) {
    if (!seen.has(entry.videoId)) {
      seen.add(entry.videoId)
      ids.push(entry.videoId)
    }
  }

  return ids
}

/**
 * Fetches a video title via YouTube oEmbed (best effort).
 * @param videoId - YouTube video id
 */
export const fetchVideoTitle = async (videoId: string): Promise<string | null> => {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
      {
        headers: {
          'User-Agent': YOUTUBE_USER_AGENT,
        },
      },
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
