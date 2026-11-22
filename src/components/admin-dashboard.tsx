'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { AdminLoginModal } from '@/components/admin-login-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VideoCategoryFilters } from '@/components/video-category-filters'
import {
  adminApi,
  adminLogout,
  isAdminAuthenticated,
  loadAdminToken,
} from '@/lib/admin-session'
import {
  DEFAULT_HOSTED_VIDEO_CATALOG,
  getHostedListUrl,
  HOSTED_VIDEOS_BASE_URL,
  parseHostedCatalogText,
  type HostedVideoFile,
} from '@/lib/hosted-videos'
import { titleFromFileName } from '@/lib/local-video-catalog'
import { cn } from '@/lib/utils'
import {
  createEmptyVideoCategoryFilters,
  filterItemsByVideoCategory,
  getVideoCategoryMeta,
} from '@/lib/video-categories'
import { getReformerLabel } from '@/lib/reformer-labels'
import type { TabletSlug, TabletUser, TabletWithUser, UserVideo } from '@/types/tablet'
import { TABLET_SLUGS } from '@/types/tablet'
import type { VideoCategoryFiltersState } from '@/types/video-category'

type AdminListResponse = {
  users: TabletUser[]
  tablets: TabletWithUser[]
  videosByUser: Record<string, UserVideo[]>
}

/**
 * Admin dashboard: users, reformer assignment, and hosted MP4 playlist picks.
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
  const [catalog, setCatalog] = useState<HostedVideoFile[]>(DEFAULT_HOSTED_VIDEO_CATALOG)
  const [catalogText, setCatalogText] = useState(
    DEFAULT_HOSTED_VIDEO_CATALOG.map((video) => video.name).join('\n'),
  )
  const [draftFileIds, setDraftFileIds] = useState<string[]>([])
  const [draftTitles, setDraftTitles] = useState<string[]>([])
  const [videoFilters, setVideoFilters] = useState<VideoCategoryFiltersState>(
    createEmptyVideoCategoryFilters,
  )
  const [isSavingVideos, setIsSavingVideos] = useState(false)
  const [isSavingCatalog, setIsSavingCatalog] = useState(false)
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | undefined>()

  const sortedCatalog = useMemo(
    () =>
      [...catalog].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      ),
    [catalog],
  )

  const filteredCatalog = useMemo(
    () => filterItemsByVideoCategory(sortedCatalog, (video) => video.name, videoFilters),
    [sortedCatalog, videoFilters],
  )

  /**
   * Reloads the hosting MP4 list into the editor (does not save until Save catalog).
   */
  const loadCatalog = useCallback(async () => {
    setIsLoadingCatalog(true)
    setError(undefined)
    setStatusMessage(undefined)

    try {
      const response = await fetch(getHostedListUrl())
      const body = await response.json() as {
        videos?: HostedVideoFile[]
        source?: string
        warning?: string
        error?: string
      }
      const videos = body.videos ?? []
      if (!response.ok || videos.length === 0) {
        throw new Error(body.error || 'Could not load videos from hosting')
      }

      setCatalog(videos)
      setCatalogText(videos.map((video) => video.name).join('\n'))
      if (body.source === 'host') {
        setStatusMessage(
          `Loaded ${videos.length} videos from hosting. Click Save catalog to keep them.`,
        )
      } else {
        setError(body.warning || 'Could not list every file in the hosting folder.')
        setStatusMessage(
          `Showing ${videos.length} known videos until the hosting folder index is available.`,
        )
      }
    } catch (catalogError) {
      const videos = DEFAULT_HOSTED_VIDEO_CATALOG
      setCatalog(videos)
      setCatalogText(videos.map((video) => video.name).join('\n'))
      setError(
        catalogError instanceof Error ? catalogError.message : 'Could not load videos from hosting',
      )
    } finally {
      setIsLoadingCatalog(false)
    }
  }, [])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(undefined)

    try {
      const response = await adminApi<AdminListResponse>({ action: 'list' })
      setData(response)
      if (!selectedUserId && response.users[0]) {
        setSelectedUserId(response.users[0].id)
      }

      await loadCatalog()
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
      setDraftTitles([])
      return
    }

    const assigned = (data.videosByUser[selectedUserId] ?? []).filter((video) =>
      /\.(mp4|m4v|webm|mov)$/i.test(video.file_name),
    )
    setDraftFileIds(assigned.map((video) => video.file_name))
    setDraftTitles(
      assigned.map((video) => video.title?.trim() || titleFromFileName(video.file_name)),
    )
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
      setError(assignError instanceof Error ? assignError.message : 'Could not assign reformer')
    }
  }

  const handleSaveCatalog = async () => {
    setIsSavingCatalog(true)
    setError(undefined)
    setStatusMessage(undefined)

    try {
      const parsed = parseHostedCatalogText(catalogText)
      if (parsed.length === 0) {
        throw new Error('Paste at least one .mp4 file name (one per line)')
      }

      const result = await adminApi<{ videos: HostedVideoFile[] }>({
        action: 'setHostedCatalog',
        fileNames: parsed.map((video) => video.name),
      })
      const videos = result.videos ?? parsed
      setCatalog(videos)
      setCatalogText(videos.map((video) => video.name).join('\n'))
      setStatusMessage(`Saved ${videos.length} hosted videos to catalog.`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save video catalog')
    } finally {
      setIsSavingCatalog(false)
    }
  }

  const toggleDraftVideo = (fileId: string) => {
    setDraftFileIds((current) => {
      if (current.includes(fileId)) {
        const next = current.filter((id) => id !== fileId)
        setDraftTitles((titles) =>
          current
            .map((id, index) => (id === fileId ? null : titles[index] ?? id))
            .filter((title): title is string => title !== null),
        )
        return next
      }

      const match = catalog.find((video) => video.id === fileId || video.name === fileId)
      setDraftTitles((titles) => [
        ...titles,
        titleFromFileName(match?.name ?? fileId),
      ])
      return [...current, fileId]
    })
  }

  /**
   * Renames the display title for an assigned draft video.
   *
   * @param index - Index in the ordered draft playlist
   */
  const renameDraftTitle = (index: number) => {
    const current = draftTitles[index] ?? titleFromFileName(draftFileIds[index] ?? '')
    const next = window.prompt('Rename video title', current)
    if (!next || !next.trim()) {
      return
    }
    setDraftTitles((titles) =>
      titles.map((title, titleIndex) => (titleIndex === index ? next.trim() : title)),
    )
  }

  /**
   * Moves an assigned draft video earlier or later in the playlist.
   *
   * @param index - Current index
   * @param direction - -1 earlier, +1 later
   */
  const moveDraftVideo = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= draftFileIds.length) {
      return
    }

    setDraftFileIds((current) => {
      const next = [...current]
      const [moved] = next.splice(index, 1)
      if (!moved) {
        return current
      }
      next.splice(nextIndex, 0, moved)
      return next
    })
    setDraftTitles((current) => {
      const next = [...current]
      const [moved] = next.splice(index, 1)
      if (moved === undefined) {
        return current
      }
      next.splice(nextIndex, 0, moved)
      return next
    })
  }

  /**
   * Renames the hosted MP4 file on the server and refreshes the catalog.
   *
   * @param fileName - Current hosted file name
   */
  const renameHostedFile = async (fileName: string) => {
    const nextName = window.prompt('Rename hosted file (keep the .mp4 extension)', fileName)
    if (!nextName || !nextName.trim() || nextName.trim() === fileName) {
      return
    }

    setError(undefined)
    setStatusMessage(undefined)
    try {
      const token = loadAdminToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/host-directory', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'rename',
          from: fileName,
          to: nextName.trim(),
        }),
      })
      const body = await response.json() as { error?: string; warning?: string }
      if (!response.ok) {
        throw new Error(body.error || 'Could not rename file')
      }

      setDraftFileIds((current) =>
        current.map((name) => (name === fileName ? nextName.trim() : name)),
      )
      setStatusMessage(`Renamed ${fileName} → ${nextName.trim()}`)
      await loadCatalog()
      await loadData()
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : 'Could not rename file')
    }
  }

  const handleSaveUserVideos = async () => {
    if (!selectedUserId) {
      return
    }

    setIsSavingVideos(true)
    setError(undefined)

    try {
      const titles = draftFileIds.map((fileId, index) =>
        draftTitles[index]?.trim() || titleFromFileName(fileId),
      )

      await adminApi({
        action: 'setUserVideos',
        userId: selectedUserId,
        fileNames: draftFileIds,
        titles,
      })
      await loadData()
      setStatusMessage('Saved assigned video order and titles.')
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
              Manage reformer users and hosted MP4 playlists.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              className="w-auto"
              onClick={() => router.push('/admin/host-directory/')}
            >
              Host Directory
            </Button>
            <Button type="button" variant="secondary" className="w-auto" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </header>

        {error ? (
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        {statusMessage ? (
          <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
            {statusMessage}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-lanta-charcoal/60">Loading admin data…</p>
        ) : (
          <>
            <section className="rounded-2xl border border-lanta-sand bg-white p-6">
              <h2 className="font-display text-2xl text-lanta-charcoal">Hosted MP4 library</h2>
              <p className="mt-1 text-sm text-lanta-charcoal/70">
                Videos stream from{' '}
                <span className="font-medium text-lanta-charcoal">{HOSTED_VIDEOS_BASE_URL}</span>.
                Reload loads all hosting MP4s; Save catalog stores the list for assignments.
              </p>
              <textarea
                value={catalogText}
                onChange={(event) => setCatalogText(event.target.value)}
                rows={10}
                className={cn(
                  'mt-4 w-full rounded-md border border-lanta-sand bg-white px-3 py-2',
                  'font-mono text-sm text-lanta-charcoal',
                )}
                placeholder={'Beginner-Arms & Back 39.mp4\nIntermediate-Athletic 45.mp4'}
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="w-auto px-6"
                  disabled={isSavingCatalog}
                  onClick={() => void handleSaveCatalog()}
                >
                  {isSavingCatalog ? 'Saving…' : 'Save catalog'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-auto px-6"
                  disabled={isLoadingCatalog}
                  onClick={() => void loadCatalog()}
                >
                  {isLoadingCatalog ? 'Loading…' : 'Reload catalog'}
                </Button>
              </div>
              <p className="mt-3 text-sm text-lanta-charcoal/60">
                {catalog.length} video{catalog.length === 1 ? '' : 's'} in catalog
              </p>
            </section>

            <section className="rounded-2xl border border-lanta-sand bg-white p-6">
              <h2 className="font-display text-2xl text-lanta-charcoal">Reformer links</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {TABLET_SLUGS.map((slug) => (
                  <a
                    key={slug}
                    href={`/${slug}/`}
                    className="rounded-lg border border-lanta-sand px-4 py-3 text-sm text-lanta-charcoal hover:bg-lanta-cream"
                  >
                    <span className="font-medium">{getReformerLabel(slug)}</span>
                    <span className="mt-1 block text-lanta-charcoal/60">/{slug}/</span>
                  </a>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-lanta-sand bg-white p-6">
              <h2 className="font-display text-2xl text-lanta-charcoal">Reformer assignments</h2>
              <div className="mt-4 grid gap-4">
                {(data?.tablets ?? []).map((tablet) => (
                  <div
                    key={tablet.slug}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-lanta-sand px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-lanta-charcoal">
                        {getReformerLabel(tablet.slug)}
                      </p>
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
              <h2 className="font-display text-2xl text-lanta-charcoal">Assign hosted videos</h2>
              <p className="mt-1 text-sm text-lanta-charcoal/70">
                Choose which MP4s this user plays. Re-save after switching from Google Drive.
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
                  No hosted videos in the catalog. Paste file names above and save.
                </p>
              ) : (
                <>
                  {draftFileIds.length > 0 ? (
                    <div className="mt-6 rounded-lg border border-lanta-sand bg-lanta-cream/40 p-4">
                      <h3 className="text-sm font-medium tracking-wide text-lanta-charcoal uppercase">
                        Playlist order
                      </h3>
                      <p className="mt-1 text-xs text-lanta-charcoal/60">
                        Rename titles, rename the hosted file, or move videos up and down.
                      </p>
                      <ol className="mt-3 space-y-2">
                        {draftFileIds.map((fileId, index) => (
                          <li
                            key={`${fileId}-${index}`}
                            className={cn(
                              'flex flex-wrap items-center justify-between gap-2',
                              'rounded-md border border-lanta-sand bg-white px-3 py-2',
                            )}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-lanta-charcoal">
                                {index + 1}.{' '}
                                {draftTitles[index] ?? titleFromFileName(fileId)}
                              </p>
                              <p className="truncate text-xs text-lanta-charcoal/50">{fileId}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                className="w-auto px-3"
                                onClick={() => renameDraftTitle(index)}
                              >
                                Rename title
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                className="w-auto px-3"
                                onClick={() => void renameHostedFile(fileId)}
                              >
                                Rename file
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="w-auto px-3"
                                disabled={index === 0}
                                onClick={() => moveDraftVideo(index, -1)}
                              >
                                Up
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="w-auto px-3"
                                disabled={index >= draftFileIds.length - 1}
                                onClick={() => moveDraftVideo(index, 1)}
                              >
                                Down
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  <div className="mt-6">
                    <VideoCategoryFilters
                      filters={videoFilters}
                      onChange={setVideoFilters}
                    />
                  </div>

                  <p className="mt-3 text-xs text-lanta-charcoal/55">
                    Showing {filteredCatalog.length} of {sortedCatalog.length}
                    {filteredCatalog.length !== sortedCatalog.length ? ' (filtered)' : ''}
                    {' · '}
                    {draftFileIds.length} selected
                  </p>

                  {filteredCatalog.length === 0 ? (
                    <p className="mt-4 rounded-lg border border-lanta-sand px-4 py-4 text-sm text-lanta-charcoal/60">
                      No videos match these filters. Clear or adjust filters to see more.
                    </p>
                  ) : (
                    <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
                      {filteredCatalog.map((video) => {
                        const checked = draftFileIds.includes(video.id)
                        const meta = getVideoCategoryMeta(video.name)
                        return (
                          <li key={video.id}>
                            <label
                              className={cn(
                                'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3',
                                checked
                                  ? 'border-lanta-taupe bg-lanta-cream/60'
                                  : 'border-lanta-sand',
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleDraftVideo(video.id)}
                                className="mt-0.5 h-4 w-4 accent-lanta-taupe"
                              />
                              <span className="min-w-0 flex-1 text-sm text-lanta-charcoal">
                                <span className="font-medium">{titleFromFileName(video.name)}</span>
                                {meta ? (
                                  <span className="mt-1 block text-xs leading-relaxed text-lanta-charcoal/55">
                                    {meta.accent} · {meta.paceCategory} · {meta.wordsPerMinute} wpm
                                    {meta.equipmentUsed.length > 0
                                      ? ` · ${meta.equipmentUsed.slice(0, 3).join(', ')}${meta.equipmentUsed.length > 3 ? '…' : ''}`
                                      : ''}
                                  </span>
                                ) : (
                                  <span className="mt-0.5 block text-xs text-lanta-charcoal/50">
                                    {video.name}
                                  </span>
                                )}
                              </span>
                            </label>
                            <button
                              type="button"
                              className={cn(
                                'mt-2 text-xs font-medium tracking-wide text-lanta-taupe uppercase',
                                'hover:text-lanta-charcoal',
                              )}
                              onClick={() => void renameHostedFile(video.name)}
                            >
                              Rename file
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}

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
