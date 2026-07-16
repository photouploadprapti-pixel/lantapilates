import { getAdminSupabase } from './_shared/supabase-server'

type TabletSlug = 'tab1' | 'tab2' | 'tab3' | 'tab4'

type AdminAction =
  | { action: 'list' }
  | { action: 'createUser'; name: string }
  | { action: 'updateUser'; id: string; name: string }
  | { action: 'deleteUser'; id: string }
  | { action: 'assignTablet'; slug: TabletSlug; userId: string | null }
  | { action: 'addVideo'; userId: string; fileName: string; title?: string }
  | { action: 'setUserVideos'; userId: string; fileNames: string[]; titles?: string[] }
  | { action: 'deleteVideo'; videoId: string }
  | { action: 'reorderVideos'; userId: string; videoIds: string[] }
  | { action: 'getSettings' }
  | { action: 'setDriveFolderUrl'; url: string }

const DEFAULT_DRIVE_FOLDER_URL =
  'https://drive.google.com/drive/folders/1wCKXxGERf3rZmvwrpBlJqSY63S9cJoBh?usp=sharing'

const ensureAppSettingsTable = async () => {
  const supabase = getAdminSupabase()
  // Best-effort: table may already exist from schema.sql
  await supabase.from('app_settings').select('key').limit(1)
}

type VideoRow = {
  id: string
  user_id: string
  youtube_video_id: string
  title: string | null
  sort_order: number
  created_at: string
}

const getEnv = (key: string): string => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`)
  }
  return value
}

const jsonResponse = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const parseToken = (header: string | undefined): string | null => {
  if (!header?.startsWith('Bearer ')) {
    return null
  }
  return header.slice(7)
}

const verifyToken = (token: string | null): boolean => {
  if (!token) {
    return false
  }

  const secret = getEnv('ADMIN_TOKEN_SECRET')
  const parts = token.split('.')
  if (parts.length !== 2) {
    return false
  }

  const [payloadB64, signature] = parts
  const expected = Buffer.from(`${payloadB64}:${secret}`).toString('base64url')
  return signature === expected
}

const getNextSortOrder = async (userId: string): Promise<number> => {
  const supabase = getAdminSupabase()
  const { data } = await supabase
    .from('user_videos')
    .select('sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: false })
    .limit(1)

  return (data?.[0]?.sort_order ?? -1) + 1
}

const titleFromFileName = (fileName: string): string =>
  fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * Maps a DB video row to the API shape used by the admin dashboard.
 * `youtube_video_id` stores local file names while YouTube is paused.
 *
 * @param row - Raw user_videos row
 */
const mapVideoRow = (row: VideoRow) => ({
  id: row.id,
  user_id: row.user_id,
  file_name: row.youtube_video_id,
  title: row.title,
  sort_order: row.sort_order,
  created_at: row.created_at,
})

const handleAction = async (payload: AdminAction) => {
  const supabase = getAdminSupabase()

  if (payload.action === 'list') {
    const [usersResult, tabletsResult] = await Promise.all([
      supabase.from('tablet_users').select('*').order('name', { ascending: true }),
      supabase
        .from('tablets')
        .select('slug, user_id, updated_at, user:tablet_users(id, name, created_at, updated_at)')
        .order('slug', { ascending: true }),
    ])

    if (usersResult.error) {
      throw new Error(usersResult.error.message)
    }
    if (tabletsResult.error) {
      throw new Error(tabletsResult.error.message)
    }

    const users = usersResult.data ?? []
    const videosByUser: Record<string, ReturnType<typeof mapVideoRow>[]> = {}

    await Promise.all(
      users.map(async (user) => {
        const { data, error } = await supabase
          .from('user_videos')
          .select('*')
          .eq('user_id', user.id)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })

        if (error) {
          throw new Error(error.message)
        }

        videosByUser[user.id] = ((data ?? []) as VideoRow[]).map(mapVideoRow)
      }),
    )

    return {
      users,
      tablets: tabletsResult.data ?? [],
      videosByUser,
    }
  }

  if (payload.action === 'getSettings') {
    await ensureAppSettingsTable()
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .eq('key', 'drive_folder_url')
      .maybeSingle()

    if (error && !error.message.includes('does not exist')) {
      throw new Error(error.message)
    }

    return {
      driveFolderUrl: data?.value ?? DEFAULT_DRIVE_FOLDER_URL,
    }
  }

  if (payload.action === 'setDriveFolderUrl') {
    const url = payload.url.trim()
    if (!url) {
      throw new Error('Drive folder URL is required')
    }

    await ensureAppSettingsTable()
    const { error } = await supabase.from('app_settings').upsert({
      key: 'drive_folder_url',
      value: url,
      updated_at: new Date().toISOString(),
    })

    if (error) {
      throw new Error(error.message)
    }

    return { driveFolderUrl: url }
  }

  if (payload.action === 'createUser') {
    const name = payload.name.trim()
    if (!name) {
      throw new Error('Name is required')
    }

    const { data, error } = await supabase
      .from('tablet_users')
      .insert({ name })
      .select('*')
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return { user: data }
  }

  if (payload.action === 'updateUser') {
    const name = payload.name.trim()
    if (!name) {
      throw new Error('Name is required')
    }

    const { data, error } = await supabase
      .from('tablet_users')
      .update({ name })
      .eq('id', payload.id)
      .select('*')
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return { user: data }
  }

  if (payload.action === 'deleteUser') {
    const { error } = await supabase.from('tablet_users').delete().eq('id', payload.id)
    if (error) {
      throw new Error(error.message)
    }

    return { ok: true }
  }

  if (payload.action === 'assignTablet') {
    const { data, error } = await supabase
      .from('tablets')
      .update({ user_id: payload.userId })
      .eq('slug', payload.slug)
      .select('slug, user_id, updated_at, user:tablet_users(id, name, created_at, updated_at)')
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return { tablet: data }
  }

  if (payload.action === 'addVideo') {
    const fileName = payload.fileName.trim()
    if (!fileName) {
      throw new Error('Video file name is required')
    }

    const sortOrder = await getNextSortOrder(payload.userId)
    const title = payload.title?.trim() || titleFromFileName(fileName)

    const { data, error } = await supabase
      .from('user_videos')
      .insert({
        user_id: payload.userId,
        youtube_video_id: fileName,
        title,
        sort_order: sortOrder,
      })
      .select('*')
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return { videos: [mapVideoRow(data as VideoRow)] }
  }

  if (payload.action === 'setUserVideos') {
    const fileNames = payload.fileNames
      .map((name) => name.trim())
      .filter((name) => name.length > 0)

    const { error: deleteError } = await supabase
      .from('user_videos')
      .delete()
      .eq('user_id', payload.userId)

    if (deleteError) {
      throw new Error(deleteError.message)
    }

    if (fileNames.length === 0) {
      return { videos: [] }
    }

    const rows = fileNames.map((fileName, index) => ({
      user_id: payload.userId,
      youtube_video_id: fileName,
      title: payload.titles?.[index]?.trim() || titleFromFileName(fileName),
      sort_order: index,
    }))

    const { data, error } = await supabase.from('user_videos').insert(rows).select('*')

    if (error) {
      throw new Error(error.message)
    }

    return { videos: ((data ?? []) as VideoRow[]).map(mapVideoRow) }
  }

  if (payload.action === 'deleteVideo') {
    const { error } = await supabase.from('user_videos').delete().eq('id', payload.videoId)
    if (error) {
      throw new Error(error.message)
    }

    return { ok: true }
  }

  if (payload.action === 'reorderVideos') {
    await Promise.all(
      payload.videoIds.map((videoId, index) =>
        supabase.from('user_videos').update({ sort_order: index }).eq('id', videoId),
      ),
    )

    return { ok: true }
  }

  throw new Error('Unknown action')
}

/**
 * Netlify admin API for managing users, tablet assignments, and local video file names.
 */
export const handler = async (event: {
  httpMethod: string
  headers: Record<string, string | undefined>
  body: string | null
}) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const token = parseToken(event.headers.authorization ?? event.headers.Authorization)
  if (!verifyToken(token)) {
    return jsonResponse(401, { error: 'Unauthorized' })
  }

  try {
    const payload = JSON.parse(event.body ?? '{}') as AdminAction
    const result = await handleAction(payload)
    return {
      ...jsonResponse(200, result),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed'
    return {
      ...jsonResponse(400, { error: message }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  }
}
