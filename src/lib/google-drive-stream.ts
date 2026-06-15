const USERCONTENT_HOST = 'drive.usercontent.google.com'

/**
 * Parses confirm/uuid tokens from Google Drive virus-scan HTML pages.
 *
 * @param html - Drive download warning page HTML
 */
const parseDriveConfirmParams = (html: string): { confirm: string; uuid?: string } => {
  const confirmMatch = html.match(/name="confirm"\s+value="([^"]+)"/)
  const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/)

  return {
    confirm: confirmMatch?.[1] ?? 't',
    uuid: uuidMatch?.[1],
  }
}

/**
 * Builds a usercontent.google.com download URL with optional confirm params.
 *
 * @param fileId - Google Drive file id
 * @param confirm - Confirm token from virus-scan page
 * @param uuid - Optional uuid from virus-scan page
 */
const buildUsercontentUrl = (
  fileId: string,
  confirm?: string,
  uuid?: string,
): string => {
  const params = new URLSearchParams({
    id: fileId,
    export: 'download',
  })

  if (confirm) params.set('confirm', confirm)
  if (uuid) params.set('uuid', uuid)

  return `https://${USERCONTENT_HOST}/download?${params.toString()}`
}

const isVideoResponse = (response: Response): boolean => {
  const contentType = response.headers.get('content-type') ?? ''
  return contentType.includes('video') || response.status === 206
}

/**
 * Resolves a direct Google Drive stream URL for HTML5 video playback.
 * Handles large-file virus-scan confirm pages automatically.
 *
 * @param fileId - Google Drive file id
 */
export const resolveGoogleDriveStreamUrl = async (fileId: string): Promise<string> => {
  const initialResponse = await fetch(
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    { redirect: 'manual' },
  )

  const redirectUrl = initialResponse.headers.get('location')
  const probeUrl = redirectUrl ?? buildUsercontentUrl(fileId)

  const probeResponse = await fetch(probeUrl, { redirect: 'manual' })

  if (isVideoResponse(probeResponse)) {
    return probeUrl
  }

  const html = await probeResponse.text()
  const { confirm, uuid } = parseDriveConfirmParams(html)

  return buildUsercontentUrl(fileId, confirm, uuid)
}
