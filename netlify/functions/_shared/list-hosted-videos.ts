const HOSTED_VIDEOS_BASE_URL = 'https://nrzmszcz.a2hosted.com/LantaVideos'

const VIDEO_NAME = /\.(mp4|m4v|webm|mov)$/i

/**
 * Pulls video file names out of an Apache / LiteSpeed directory index.
 *
 * @param html - Directory listing HTML
 */
export const parseHostedDirectoryHtml = (html: string): string[] => {
  const names = new Set<string>()
  const hrefPattern = /href\s*=\s*["']([^"'#]+)["']/gi
  let match = hrefPattern.exec(html)

  while (match) {
    const path = match[1].split('?')[0]
    let decoded = path
    try {
      decoded = decodeURIComponent(path)
    } catch {
      decoded = path
    }
    const name = decoded.split('/').pop()?.trim() ?? ''
    if (name && VIDEO_NAME.test(name) && !name.includes('..')) {
      names.add(name)
    }
    match = hrefPattern.exec(html)
  }

  return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

/**
 * Lists every video file published under the a2hosting LantaVideos folder.
 */
export const listHostedVideoNames = async (): Promise<string[]> => {
  const response = await fetch(`${HOSTED_VIDEOS_BASE_URL}/`, {
    signal: AbortSignal.timeout(20000),
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
        + '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    redirect: 'follow',
  })

  const html = await response.text()
  if (!response.ok) {
    throw new Error(
      `Hosting refused the folder index (${response.status}). `
      + 'Turn on directory indexes for /LantaVideos so the catalog can sync.',
    )
  }

  const names = parseHostedDirectoryHtml(html)
  if (names.length === 0) {
    throw new Error('The hosting folder index did not include any video files.')
  }

  return names
}
