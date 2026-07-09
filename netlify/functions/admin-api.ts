import { createClient } from '@supabase/supabase-js'

import {
  fetchPlaylistVideoIds,
  fetchVideoTitle,
  parseYouTubeInput,
} from './_shared/youtube-parse'

type TabletSlug = 'tab1' | 'tab2' | 'tab3' | 'tab4'

type AdminAction =
  | { action: 'list' }
  | { action: 'createUser'; name: string }
  | { action: 'updateUser'; id: string; name: string }
  | { action: 'deleteUser'; id: string }
  | { action: 'assignTablet'; slug: TabletSlug; userId: string | null }
  | { action: 'addVideo'; userId: string; url: string }
  | { action: 'deleteVideo'; videoId: string }
  | { action: 'reorderVideos'; userId: string; videoIds: string[] }

const getEnv = (key: string): string => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`)
  }
  return value
}

const getAdminSupabase = () =>
  createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

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
    const videosByUser: Record<string, unknown[]> = {}

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

        videosByUser[user.id] = data ?? []
      }),
    )

    return {
      users,
      tablets: tabletsResult.data ?? [],
      videosByUser,
    }
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
    const parsed = parseYouTubeInput(payload.url)
    if (parsed.kind === 'invalid') {
      throw new Error('Enter a valid YouTube video or playlist URL')
    }

    let sortOrder = await getNextSortOrder(payload.userId)
    const inserted: unknown[] = []

    if (parsed.kind === 'video') {
      const title = await fetchVideoTitle(parsed.videoId)
      const { data, error } = await supabase
        .from('user_videos')
        .insert({
          user_id: payload.userId,
          youtube_video_id: parsed.videoId,
          title,
          sort_order: sortOrder,
        })
        .select('*')
        .single()

      if (error) {
        throw new Error(error.message)
      }

      inserted.push(data)
    } else {
      const videoIds = await fetchPlaylistVideoIds(parsed.playlistId)
      if (videoIds.length === 0) {
        throw new Error('No videos found in that playlist')
      }

      for (const videoId of videoIds) {
        const title = await fetchVideoTitle(videoId)
        const { data, error } = await supabase
          .from('user_videos')
          .insert({
            user_id: payload.userId,
            youtube_video_id: videoId,
            title,
            sort_order: sortOrder,
          })
          .select('*')
          .single()

        if (error) {
          throw new Error(error.message)
        }

        inserted.push(data)
        sortOrder += 1
      }
    }

    return { videos: inserted }
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
 * Netlify admin API for managing users, tablet assignments, and videos.
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
