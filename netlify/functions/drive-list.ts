import { getAdminSupabase } from './_shared/supabase-server'
import {
  DEFAULT_DRIVE_FOLDER_ID,
  isDriveVideoName,
  parseDriveFolderId,
} from './_shared/drive'

type DriveListItem = {
  id: string
  name: string
  mimeType?: string
  size?: string
}

const jsonResponse = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(body),
})

const resolveFolderId = async (event: {
  queryStringParameters?: Record<string, string | undefined> | null
}): Promise<string> => {
  const fromQuery = event.queryStringParameters?.folderId?.trim()
  if (fromQuery) {
    return parseDriveFolderId(fromQuery) ?? fromQuery
  }

  try {
    const supabase = getAdminSupabase()
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'drive_folder_url')
      .maybeSingle()

    const parsed = data?.value ? parseDriveFolderId(data.value) : null
    if (parsed) {
      return parsed
    }
  } catch {
    // Fall through to env/default when settings table is unavailable.
  }

  const fromEnv = process.env.DRIVE_FOLDER_ID?.trim()
  if (fromEnv) {
    return parseDriveFolderId(fromEnv) ?? fromEnv
  }

  return DEFAULT_DRIVE_FOLDER_ID
}

/**
 * Lists video files in a shared Google Drive folder via Drive API v3.
 */
export const handler = async (event: {
  httpMethod: string
  queryStringParameters?: Record<string, string | undefined> | null
}) => {
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

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY?.trim()
  if (!apiKey) {
    return jsonResponse(500, {
      error:
        'Missing GOOGLE_DRIVE_API_KEY. Add a Google Cloud API key with Drive API enabled.',
    })
  }

  const folderId = await resolveFolderId(event)
  const files: DriveListItem[] = []
  let pageToken: string | undefined

  try {
    do {
      const params = new URLSearchParams({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size)',
        pageSize: '1000',
        key: apiKey,
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
      })

      if (pageToken) {
        params.set('pageToken', pageToken)
      }

      const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`)
      const payload = (await response.json()) as {
        error?: { message?: string }
        files?: DriveListItem[]
        nextPageToken?: string
      }

      if (!response.ok) {
        throw new Error(payload.error?.message ?? 'Drive list request failed')
      }

      for (const file of payload.files ?? []) {
        if (isDriveVideoName(file.name)) {
          files.push(file)
        }
      }

      pageToken = payload.nextPageToken
    } while (pageToken)

    files.sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
    )

    return jsonResponse(200, {
      folderId,
      videos: files,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not list Drive videos'
    return jsonResponse(400, { error: message })
  }
}
