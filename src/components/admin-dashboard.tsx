'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { AdminLoginModal } from '@/components/admin-login-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  catalogFromLocalFiles,
  loadAdminVideoCatalog,
  saveAdminVideoCatalog,
  type AdminVideoCatalog,
} from '@/lib/admin-video-catalog'
import { adminApi, adminLogout, isAdminAuthenticated } from '@/lib/admin-session'
import { scanAdminDirectory } from '@/lib/web-video-folder'
import { cn } from '@/lib/utils'
import type { TabletSlug, TabletUser, TabletWithUser, UserVideo } from '@/types/tablet'
import { TABLET_SLUGS } from '@/types/tablet'

type AdminListResponse = {
  users: TabletUser[]
  tablets: TabletWithUser[]
  videosByUser: Record<string, UserVideo[]>
}

/**
 * Admin dashboard for users, tablet assignments, and local video playlists.
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
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [catalog, setCatalog] = useState<AdminVideoCatalog | null>(null)
  const [draftFileNames, setDraftFileNames] = useState<string[]>([])
  const [isPickingFolder, setIsPickingFolder] = useState(false)
  const [isSavingVideos, setIsSavingVideos] = useState(false)

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
    setCatalog(loadAdminVideoCatalog())

    if (authed) {
      void loadData()
    } else {
      setIsLoading(false)
    }
  }, [loadData])

  useEffect(() => {
    if (!selectedUserId || !data) {
      setDraftFileNames([])
      return
    }

    const assigned = data.videosByUser[selectedUserId] ?? []
    setDraftFileNames(assigned.map((video) => video.file_name))
  }, [selectedUserId, data])

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

  const handlePickVideoFolder = async () => {
    setIsPickingFolder(true)
    setError(undefined)

    try {
      const result = await scanAdminDirectory()
      const nextCatalog = catalogFromLocalFiles(result.folderName, result.videos)
      saveAdminVideoCatalog(nextCatalog)
      setCatalog(nextCatalog)
    } catch (pickError) {
      setError(pickError instanceof Error ? pickError.message : 'Could not select video folder')
    } finally {
      setIsPickingFolder(false)
    }
  }

  const toggleDraftVideo = (fileName: string) => {
    setDraftFileNames((current) =>
      current.includes(fileName)
        ? current.filter((name) => name !== fileName)
        : [...current, fileName],
    )
  }

  const handleSaveUserVideos = async () => {
    if (!selectedUserId) {
      return
    }

    setIsSavingVideos(true)
    setError(undefined)

    try {
      await adminApi({
        action: 'setUserVideos',
        userId: selectedUserId,
        fileNames: draftFileNames,
      })
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save videos')
    } finally {
      setIsSavingVideos(false)
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

  const selectedVideos = selectedUserId ? data?.videosByUser[selectedUserId] ?? [] : []
  const catalogNames = useMemo(
    () => new Set((catalog?.videos ?? []).map((video) => video.name)),
    [catalog],
  )

  const orphanAssigned = selectedVideos.filter((video) => !catalogNames.has(video.file_name))

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

  return (
    <div className="min-h-dvh bg-lanta-cream px-4 py-8 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl text-lanta-charcoal">Admin</h1>
            <p className="mt-1 text-sm text-lanta-charcoal/70">
              Manage tablet users, assignments, and local video playlists.
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
                <Button
                  type="button"
                  className="w-auto px-6"
                  disabled={!newUserName.trim()}
                  onClick={() => void handleCreateUser()}
                >
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
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl text-lanta-charcoal">Video library</h2>
                  <p className="mt-1 text-sm text-lanta-charcoal/70">
                    Select the folder that contains your workout videos (including .ts / MPEG-TS).
                    File names are the key used on tablets (online and offline).
                  </p>
                </div>
                <Button
                  type="button"
                  className="w-auto px-6"
                  disabled={isPickingFolder}
                  onClick={() => void handlePickVideoFolder()}
                >
                  {isPickingFolder ? 'Opening…' : catalog ? 'Change video folder' : 'Select video folder'}
                </Button>
              </div>

              {catalog ? (
                <div className="mt-4">
                  <p className="text-sm text-lanta-charcoal/70">
                    Folder: <span className="font-medium text-lanta-charcoal">{catalog.folderName}</span>
                    {' · '}
                    {catalog.videos.length} video{catalog.videos.length === 1 ? '' : 's'}
                  </p>
                  <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-lanta-sand p-3">
                    {catalog.videos.map((video) => (
                      <li key={video.name} className="text-sm text-lanta-charcoal">
                        {video.title}
                        <span className="ml-2 text-lanta-charcoal/50">{video.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-4 text-sm text-lanta-charcoal/60">
                  No video folder selected yet. Choose the same folder you will also copy onto each
                  tablet.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-lanta-sand bg-white p-6">
              <h2 className="font-display text-2xl text-lanta-charcoal">Assign videos to user</h2>
              <p className="mt-1 text-sm text-lanta-charcoal/70">
                Pick which videos from the library this user should see. Matching on the tablet is by
                file name.
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
              </div>

              {!catalog ? (
                <p className="mt-6 text-sm text-lanta-charcoal/60">
                  Select a video folder above before assigning videos.
                </p>
              ) : selectedUserId ? (
                <>
                  <ul className="mt-6 max-h-80 space-y-2 overflow-y-auto">
                    {catalog.videos.map((video) => {
                      const checked = draftFileNames.includes(video.name)
                      return (
                        <li key={video.name}>
                          <label
                            className={cn(
                              'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3',
                              checked ? 'border-lanta-taupe bg-lanta-cream/60' : 'border-lanta-sand',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleDraftVideo(video.name)}
                              className="h-4 w-4 accent-lanta-taupe"
                            />
                            <span className="text-sm text-lanta-charcoal">
                              {video.title}
                              <span className="ml-2 text-lanta-charcoal/50">{video.name}</span>
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>

                  {orphanAssigned.length > 0 ? (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-sm text-amber-900">
                        Assigned videos not in the current folder (still saved for this user):
                      </p>
                      <ul className="mt-2 space-y-2">
                        {orphanAssigned.map((video) => (
                          <li
                            key={video.id}
                            className="flex flex-wrap items-center justify-between gap-2 text-sm"
                          >
                            <span>{video.file_name}</span>
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
                      </ul>
                    </div>
                  ) : null}

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      className="w-auto px-6"
                      disabled={isSavingVideos}
                      onClick={() => void handleSaveUserVideos()}
                    >
                      {isSavingVideos ? 'Saving…' : 'Save assigned videos'}
                    </Button>
                    <p className="text-sm text-lanta-charcoal/60">
                      {draftFileNames.length} selected
                    </p>
                  </div>
                </>
              ) : (
                <p className="mt-6 text-sm text-lanta-charcoal/60">Choose a user to assign videos.</p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
