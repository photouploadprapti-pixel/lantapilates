'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { AdminLoginModal } from '@/components/admin-login-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminApi, adminLogout, isAdminAuthenticated } from '@/lib/admin-session'
import {
  DEFAULT_DRIVE_FOLDER_URL,
  getDriveListUrl,
  parseDriveFolderId,
  type DriveVideoFile,
} from '@/lib/drive-folder'
import { titleFromFileName } from '@/lib/local-video-catalog'
import { cn } from '@/lib/utils'
import type { TabletSlug, TabletUser, TabletWithUser, UserVideo } from '@/types/tablet'
import { TABLET_SLUGS } from '@/types/tablet'

type AdminListResponse = {
  users: TabletUser[]
  tablets: TabletWithUser[]
  videosByUser: Record<string, UserVideo[]>
}

type SettingsResponse = {
  driveFolderUrl: string
}

/**
 * Admin dashboard: users, tablet assignment, Drive folder URL, and per-user video picks.
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
  const [driveFolderUrl, setDriveFolderUrl] = useState(DEFAULT_DRIVE_FOLDER_URL)
  const [catalog, setCatalog] = useState<DriveVideoFile[]>([])
  const [draftFileIds, setDraftFileIds] = useState<string[]>([])
  const [isSavingVideos, setIsSavingVideos] = useState(false)
  const [isSavingDriveUrl, setIsSavingDriveUrl] = useState(false)
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false)

  const loadCatalog = useCallback(async (folderUrl?: string) => {
    setIsLoadingCatalog(true)
    setError(undefined)

    try {
      const folderId = parseDriveFolderId(folderUrl ?? driveFolderUrl) ?? undefined
      const response = await fetch(getDriveListUrl(folderId))
      const payload = (await response.json()) as {
        videos?: DriveVideoFile[]
        error?: string
      }

      if (!response.ok) {
        throw new Error(payload.error ?? 'Could not load Drive videos')
      }

      setCatalog(payload.videos ?? [])
    } catch (loadError) {
      setCatalog([])
      setError(loadError instanceof Error ? loadError.message : 'Could not load Drive videos')
    } finally {
      setIsLoadingCatalog(false)
    }
  }, [driveFolderUrl])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(undefined)

    try {
      const [response, settings] = await Promise.all([
        adminApi<AdminListResponse>({ action: 'list' }),
        adminApi<SettingsResponse>({ action: 'getSettings' }),
      ])
      setData(response)
      setDriveFolderUrl(settings.driveFolderUrl || DEFAULT_DRIVE_FOLDER_URL)
      if (!selectedUserId && response.users[0]) {
        setSelectedUserId(response.users[0].id)
      }
      await loadCatalog(settings.driveFolderUrl || DEFAULT_DRIVE_FOLDER_URL)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load admin data')
    } finally {
      setIsLoading(false)
    }
  }, [selectedUserId, loadCatalog])

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

  useEffect(() => {
    if (!selectedUserId || !data) {
      setDraftFileIds([])
      return
    }

    const assigned = data.videosByUser[selectedUserId] ?? []
    setDraftFileIds(assigned.map((video) => video.file_name))
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

  const handleSaveDriveUrl = async () => {
    setIsSavingDriveUrl(true)
    setError(undefined)

    try {
      const folderId = parseDriveFolderId(driveFolderUrl)
      if (!folderId) {
        throw new Error('Enter a valid Google Drive folder URL or id')
      }

      await adminApi({ action: 'setDriveFolderUrl', url: driveFolderUrl.trim() })
      await loadCatalog(driveFolderUrl.trim())
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save Drive URL')
    } finally {
      setIsSavingDriveUrl(false)
    }
  }

  const toggleDraftVideo = (fileId: string) => {
    setDraftFileIds((current) =>
      current.includes(fileId)
        ? current.filter((id) => id !== fileId)
        : [...current, fileId],
    )
  }

  const handleSaveUserVideos = async () => {
    if (!selectedUserId) {
      return
    }

    setIsSavingVideos(true)
    setError(undefined)

    try {
      const titles = draftFileIds.map((fileId) => {
        const match = catalog.find((video) => video.id === fileId)
        return match?.name ?? fileId
      })

      await adminApi({
        action: 'setUserVideos',
        userId: selectedUserId,
        fileNames: draftFileIds,
        titles,
      })
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save videos')
    } finally {
      setIsSavingVideos(false)
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

  return (
    <div className="min-h-dvh bg-lanta-cream px-4 py-8 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl text-lanta-charcoal">Admin</h1>
            <p className="mt-1 text-sm text-lanta-charcoal/70">
              Manage tablet users and Google Drive video playlists.
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
              <h2 className="font-display text-2xl text-lanta-charcoal">Google Drive source</h2>
              <p className="mt-1 text-sm text-lanta-charcoal/70">
                Shared folder of workout videos (.ts and other formats). Tablets stream from this
                folder online.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Input
                  value={driveFolderUrl}
                  onChange={(event) => setDriveFolderUrl(event.target.value)}
                  placeholder="https://drive.google.com/drive/folders/…"
                  className="min-w-[16rem] flex-1"
                />
                <Button
                  type="button"
                  className="w-auto px-6"
                  disabled={isSavingDriveUrl}
                  onClick={() => void handleSaveDriveUrl()}
                >
                  {isSavingDriveUrl ? 'Saving…' : 'Save Drive URL'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-auto px-6"
                  disabled={isLoadingCatalog}
                  onClick={() => void loadCatalog()}
                >
                  {isLoadingCatalog ? 'Refreshing…' : 'Refresh videos'}
                </Button>
              </div>
              <p className="mt-3 text-sm text-lanta-charcoal/60">
                {isLoadingCatalog
                  ? 'Loading videos from Drive…'
                  : `${catalog.length} video${catalog.length === 1 ? '' : 's'} found`}
              </p>
            </section>

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
                      selectedUserId === user.id
                        ? 'border-lanta-taupe bg-lanta-cream/60'
                        : 'border-lanta-sand',
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
              <h2 className="font-display text-2xl text-lanta-charcoal">Assign Drive videos</h2>
              <p className="mt-1 text-sm text-lanta-charcoal/70">
                Choose which Drive videos this user should play on their tablet.
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

              {!selectedUserId ? (
                <p className="mt-6 text-sm text-lanta-charcoal/60">Choose a user to assign videos.</p>
              ) : catalog.length === 0 ? (
                <p className="mt-6 text-sm text-lanta-charcoal/60">
                  No Drive videos loaded. Save the folder URL and refresh.
                </p>
              ) : (
                <>
                  <ul className="mt-6 max-h-80 space-y-2 overflow-y-auto">
                    {catalog.map((video) => {
                      const checked = draftFileIds.includes(video.id)
                      return (
                        <li key={video.id}>
                          <label
                            className={cn(
                              'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3',
                              checked
                                ? 'border-lanta-taupe bg-lanta-cream/60'
                                : 'border-lanta-sand',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleDraftVideo(video.id)}
                              className="h-4 w-4 accent-lanta-taupe"
                            />
                            <span className="text-sm text-lanta-charcoal">
                              {titleFromFileName(video.name)}
                              <span className="ml-2 text-lanta-charcoal/50">{video.name}</span>
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      className="w-auto px-6"
                      disabled={isSavingVideos}
                      onClick={() => void handleSaveUserVideos()}
                    >
                      {isSavingVideos ? 'Saving…' : 'Save assigned videos'}
                    </Button>
                    <p className="text-sm text-lanta-charcoal/60">{draftFileIds.length} selected</p>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
