'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { AdminLoginModal } from '@/components/admin-login-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminApi, adminLogout, isAdminAuthenticated } from '@/lib/admin-session'
import { cn } from '@/lib/utils'
import type { TabletSlug, TabletUser, TabletWithUser, UserVideo } from '@/types/tablet'
import { TABLET_SLUGS } from '@/types/tablet'

type AdminListResponse = {
  users: TabletUser[]
  tablets: TabletWithUser[]
  videosByUser: Record<string, UserVideo[]>
}

/**
 * Admin dashboard for users, tablet assignments, and video playlists.
 */
export const AdminDashboard = () => {
  const router = useRouter()
  const [isAuthed, setIsAuthed] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [data, setData] = useState<AdminListResponse | null>(null)
  const [error, setError] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [newUserName, setNewUserName] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(undefined)

    try {
      const response = await adminApi<AdminListResponse>({ action: 'list' })
      setData(response)
      if (!selectedUserId && response.users[0]) {
        setSelectedUserId(response.users[0].id)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load admin data')
    } finally {
      setIsLoading(false)
    }
  }, [selectedUserId])

  useEffect(() => {
    const authed = isAdminAuthenticated()
    setIsAuthed(authed)
    setShowLogin(!authed)

    if (authed) {
      void loadData()
    } else {
      setIsLoading(false)
    }
  }, [loadData])

  const handleCreateUser = async () => {
    try {
      await adminApi({ action: 'createUser', name: newUserName })
      setNewUserName('')
      await loadData()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create user')
    }
  }

  const handleUpdateUser = async (id: string) => {
    try {
      await adminApi({ action: 'updateUser', id, name: editingName })
      setEditingUserId(null)
      setEditingName('')
      await loadData()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update user')
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Delete this user and all assigned videos?')) {
      return
    }

    try {
      await adminApi({ action: 'deleteUser', id })
      if (selectedUserId === id) {
        setSelectedUserId(null)
      }
      await loadData()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete user')
    }
  }

  const handleAssignTablet = async (slug: TabletSlug, userId: string | null) => {
    try {
      await adminApi({ action: 'assignTablet', slug, userId })
      await loadData()
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : 'Could not assign tablet')
    }
  }

  const handleAddVideo = async () => {
    if (!selectedUserId) {
      return
    }

    try {
      await adminApi({ action: 'addVideo', userId: selectedUserId, url: videoUrl })
      setVideoUrl('')
      await loadData()
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Could not add video')
    }
  }

  const handleDeleteVideo = async (videoId: string) => {
    try {
      await adminApi({ action: 'deleteVideo', videoId })
      await loadData()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete video')
    }
  }

  const handleLogout = () => {
    adminLogout()
    setIsAuthed(false)
    setShowLogin(true)
    setData(null)
  }

  if (!isAuthed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-lanta-cream px-6">
        <AdminLoginModal
          open={showLogin}
          onClose={() => router.push('/tab1/')}
          onSuccess={() => {
            setIsAuthed(true)
            setShowLogin(false)
            void loadData()
          }}
        />
        {!showLogin ? (
          <Button type="button" onClick={() => setShowLogin(true)}>
            Open admin login
          </Button>
        ) : null}
      </div>
    )
  }

  const selectedVideos = selectedUserId ? data?.videosByUser[selectedUserId] ?? [] : []

  return (
    <div className="min-h-dvh bg-lanta-cream px-4 py-8 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl text-lanta-charcoal">Admin</h1>
            <p className="mt-1 text-sm text-lanta-charcoal/70">
              Manage tablet users, assignments, and video playlists.
            </p>
          </div>
          <Button type="button" variant="secondary" className="w-auto" onClick={handleLogout}>
            Sign out
          </Button>
        </header>

        {error ? (
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-lanta-charcoal/60">Loading admin data…</p>
        ) : (
          <>
            <section className="rounded-2xl border border-lanta-sand bg-white p-6">
              <h2 className="font-display text-2xl text-lanta-charcoal">Tablet links</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {TABLET_SLUGS.map((slug) => (
                  <a
                    key={slug}
                    href={`/${slug}/`}
                    className="rounded-lg border border-lanta-sand px-4 py-3 text-sm text-lanta-charcoal hover:bg-lanta-cream"
                  >
                    /{slug}/
                  </a>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-lanta-sand bg-white p-6">
              <h2 className="font-display text-2xl text-lanta-charcoal">Tablet assignments</h2>
              <div className="mt-4 grid gap-4">
                {(data?.tablets ?? []).map((tablet) => (
                  <div
                    key={tablet.slug}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-lanta-sand px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-lanta-charcoal">{tablet.slug.toUpperCase()}</p>
                      <p className="text-sm text-lanta-charcoal/60">/{tablet.slug}/</p>
                    </div>
                    <select
                      value={tablet.user_id ?? ''}
                      onChange={(event) =>
                        void handleAssignTablet(
                          tablet.slug,
                          event.target.value ? event.target.value : null,
                        )
                      }
                      className="min-w-[12rem] rounded-md border border-lanta-sand bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Unassigned</option>
                      {(data?.users ?? []).map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-lanta-sand bg-white p-6">
              <h2 className="font-display text-2xl text-lanta-charcoal">Users</h2>

              <div className="mt-4 flex flex-wrap gap-3">
                <Input
                  placeholder="New user name"
                  value={newUserName}
                  onChange={(event) => setNewUserName(event.target.value)}
                  className="max-w-xs"
                />
                <Button type="button" className="w-auto px-6" onClick={() => void handleCreateUser()}>
                  Add user
                </Button>
              </div>

              <ul className="mt-6 space-y-3">
                {(data?.users ?? []).map((user) => (
                  <li
                    key={user.id}
                    className={cn(
                      'rounded-lg border px-4 py-3',
                      selectedUserId === user.id ? 'border-lanta-taupe bg-lanta-cream/60' : 'border-lanta-sand',
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {editingUserId === user.id ? (
                        <Input
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          className="max-w-xs"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(user.id)}
                          className="text-left font-medium text-lanta-charcoal"
                        >
                          {user.name}
                        </button>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {editingUserId === user.id ? (
                          <Button
                            type="button"
                            className="w-auto px-4"
                            onClick={() => void handleUpdateUser(user.id)}
                          >
                            Save
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            className="w-auto px-4"
                            onClick={() => {
                              setEditingUserId(user.id)
                              setEditingName(user.name)
                            }}
                          >
                            Edit
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-red-700"
                          onClick={() => void handleDeleteUser(user.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-lanta-sand bg-white p-6">
              <h2 className="font-display text-2xl text-lanta-charcoal">User videos</h2>
              <p className="mt-1 text-sm text-lanta-charcoal/70">
                Paste a YouTube video link or playlist link for the selected user.
              </p>

              <div className="mt-4 grid gap-3">
                <Label htmlFor="video-user">Selected user</Label>
                <select
                  id="video-user"
                  value={selectedUserId ?? ''}
                  onChange={(event) => setSelectedUserId(event.target.value || null)}
                  className="max-w-md rounded-md border border-lanta-sand bg-white px-3 py-2 text-sm"
                >
                  <option value="">Choose a user</option>
                  {(data?.users ?? []).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>

                <Label htmlFor="video-url">YouTube URL</Label>
                <div className="flex flex-wrap gap-3">
                  <Input
                    id="video-url"
                    placeholder="https://www.youtube.com/watch?v=… or playlist URL"
                    value={videoUrl}
                    onChange={(event) => setVideoUrl(event.target.value)}
                    className="min-w-[16rem] flex-1"
                  />
                  <Button
                    type="button"
                    className="w-auto px-6"
                    disabled={!selectedUserId || !videoUrl.trim()}
                    onClick={() => void handleAddVideo()}
                  >
                    Add video(s)
                  </Button>
                </div>
              </div>

              <ul className="mt-6 space-y-3">
                {selectedVideos.map((video, index) => (
                  <li
                    key={video.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-lanta-sand px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-lanta-charcoal">
                        {index + 1}. {video.title ?? video.youtube_video_id}
                      </p>
                      <p className="text-sm text-lanta-charcoal/60">{video.youtube_video_id}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-red-700"
                      onClick={() => void handleDeleteVideo(video.id)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
                {selectedUserId && selectedVideos.length === 0 ? (
                  <p className="text-sm text-lanta-charcoal/60">No videos assigned yet.</p>
                ) : null}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
