'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AdminLoginModal } from '@/components/admin-login-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isAdminAuthenticated, loadAdminToken } from '@/lib/admin-session'
import { HOSTING_FTP_ENV_KEYS } from '@/lib/hosting-setup'
import { cn } from '@/lib/utils'

const CHUNK_BYTES = 3 * 1024 * 1024
const API_PATH = '/api/host-directory/'

type HostDirectoryVideo = {
  name: string
  url: string
  bytes: number | null
  modifiedAt: string | null
}

type HostDirectoryResponse = {
  videos?: HostDirectoryVideo[]
  source?: 'ftp' | 'index' | 'fallback'
  ftpConfigured?: boolean
  canManage?: boolean
  baseUrl?: string
  warning?: string
  error?: string
}

type UploadProgress = {
  name: string
  completed: number
  total: number
}

const EMPTY_VIDEOS: HostDirectoryVideo[] = []

/**
 * Formats a byte count for the directory list.
 *
 * @param bytes - Size in bytes, or null when the host did not report it
 */
const formatBytes = (bytes: number | null): string => {
  if (bytes === null || Number.isNaN(bytes)) {
    return ''
  }
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }
  const mb = bytes / (1024 * 1024)
  if (mb < 1024) {
    return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} MB`
  }
  return `${(mb / 1024).toFixed(2)} GB`
}

/**
 * Reads a JSON payload and surfaces non-JSON failures.
 *
 * @param response - Fetch response from the host directory API
 */
const readJson = async (response: Response): Promise<HostDirectoryResponse> => {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error('Host directory API did not return JSON')
  }
  return (await response.json()) as HostDirectoryResponse
}

/**
 * Admin screen for the public LantaVideos folder: play, rename, and upload.
 */
export const HostDirectoryScreen = () => {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isAuthed, setIsAuthed] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [directory, setDirectory] = useState<HostDirectoryResponse | null>(null)
  const [error, setError] = useState<string | undefined>()
  const [statusMessage, setStatusMessage] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [nextName, setNextName] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)

  const videos = directory?.videos ?? EMPTY_VIDEOS
  const canManage = directory?.canManage === true
  const filteredVideos = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) {
      return videos
    }
    return videos.filter((video) => video.name.toLowerCase().includes(needle))
  }, [query, videos])

  /**
   * Loads the current folder listing.
   */
  const loadDirectory = useCallback(async () => {
    setIsLoading(true)
    setError(undefined)

    try {
      const token = loadAdminToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(API_PATH, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await readJson(response)
      if (!response.ok) {
        throw new Error(body.error || 'Could not load the host directory')
      }
      setDirectory(body)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the host directory')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) {
        return
      }
      const authed = isAdminAuthenticated()
      setIsAuthed(authed)
      setShowLogin(!authed)
      if (authed) {
        void loadDirectory()
      } else {
        setIsLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [loadDirectory])

  /**
   * Renames one file on the host and refreshes the list.
   *
   * @param from - Current file name
   */
  const handleRename = async (from: string) => {
    const to = nextName.trim()
    if (!to || to === from) {
      setEditingName(null)
      return
    }

    setIsRenaming(true)
    setError(undefined)
    setStatusMessage(undefined)

    try {
      const token = loadAdminToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(API_PATH, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'rename', from, to }),
      })
      const body = await readJson(response)
      if (!response.ok) {
        throw new Error(body.error || 'Could not rename the video')
      }

      setEditingName(null)
      setNextName('')
      setStatusMessage(body.warning || `Renamed to ${to}`)
      await loadDirectory()
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : 'Could not rename the video')
    } finally {
      setIsRenaming(false)
    }
  }

  /**
   * Uploads one file in chunks small enough for the hosting API.
   *
   * @param file - Video chosen in the file picker
   */
  const uploadFile = async (file: File) => {
    const token = loadAdminToken()
    if (!token) {
      throw new Error('Not authenticated')
    }
    if (file.size <= 0) {
      throw new Error(`${file.name} is empty`)
    }

    const total = Math.ceil(file.size / CHUNK_BYTES)
    for (let index = 0; index < total; index += 1) {
      const start = index * CHUNK_BYTES
      const chunk = file.slice(start, start + CHUNK_BYTES)
      setUploadProgress({ name: file.name, completed: index, total })

      const response = await fetch(API_PATH, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
          'x-file-name': encodeURIComponent(file.name),
          'x-chunk-index': String(index),
          'x-chunk-total': String(total),
        },
        body: chunk,
      })
      const body = await readJson(response)
      if (!response.ok) {
        throw new Error(body.error || `Could not upload ${file.name}`)
      }
      if (body.warning) {
        setStatusMessage(body.warning)
      }
    }

    setUploadProgress({ name: file.name, completed: total, total })
  }

  /**
   * Uploads every selected video, then reloads the folder.
   *
   * @param files - Files from the picker
   */
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return
    }

    setError(undefined)
    setStatusMessage(undefined)

    try {
      for (const file of Array.from(files)) {
        await uploadFile(file)
      }
      setStatusMessage(
        files.length === 1
          ? `Uploaded ${files[0]?.name ?? 'video'}`
          : `Uploaded ${files.length} videos`,
      )
      await loadDirectory()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload the video')
    } finally {
      setUploadProgress(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  if (!isAuthed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-lanta-cream px-6">
        <AdminLoginModal
          open={showLogin}
          onClose={() => router.push('/admin/')}
          onSuccess={() => {
            setIsAuthed(true)
            setShowLogin(false)
            void loadDirectory()
          }}
        />
        {!showLogin ? (
          <p className="text-sm text-lanta-charcoal/60">Loading…</p>
        ) : null}
      </div>
    )
  }

  const baseUrl = directory?.baseUrl ?? 'https://nrzmszcz.a2hosted.com/LantaVideos'
  const uploadPercent = uploadProgress
    ? Math.round((uploadProgress.completed / uploadProgress.total) * 100)
    : 0

  return (
    <div className="min-h-dvh bg-lanta-cream px-4 py-8 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl text-lanta-charcoal">Host Directory</h1>
            <p className="mt-1 text-sm text-lanta-charcoal/70">
              Videos in {baseUrl}. Click a name to play it in a new tab.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              className="w-auto"
              onClick={() => router.push('/admin/')}
            >
              Back to admin
            </Button>
          </div>
        </header>

        {error ? (
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        {directory?.warning ? (
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {directory.warning}
          </p>
        ) : null}

        {statusMessage ? (
          <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
            {statusMessage}
          </p>
        ) : null}

        {directory && !directory.ftpConfigured ? (
          <section
            className={cn(
              'rounded-md border border-amber-200 bg-amber-50 px-4 py-3',
              'text-sm text-amber-950',
            )}
          >
            <p>
              The host blocks folder indexes, so this page cannot change files until FTP
              is connected. In Vercel, open Settings → Environment Variables and add:
            </p>
            <ul className="mt-2 list-disc pl-5 font-mono text-xs">
              {HOSTING_FTP_ENV_KEYS.map((key) => (
                <li key={key}>{key}</li>
              ))}
            </ul>
            <p className="mt-2">
              HOSTING_FTP_REMOTE_DIR is usually /public_html/LantaVideos. Optional:
              HOSTING_FTP_PORT=21 and HOSTING_FTP_SECURE=true. Use the cPanel FTP host,
              username, and password, then redeploy.
            </p>
          </section>
        ) : null}

        {directory?.ftpConfigured && !canManage ? (
          <p
            className={cn(
              'rounded-md border border-amber-200 bg-amber-50 px-4 py-3',
              'text-sm text-amber-950',
            )}
          >
            FTP settings are present, but the folder did not open. Check
            HOSTING_FTP_REMOTE_DIR (usually /public_html/LantaVideos), the password,
            and HOSTING_FTP_SECURE.
          </p>
        ) : null}

        <section className="rounded-2xl border border-lanta-sand bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-lanta-charcoal">Videos</h2>
            <Button
              type="button"
              variant="secondary"
              className="w-auto px-6"
              disabled={isLoading || uploadProgress !== null}
              onClick={() => void loadDirectory()}
            >
              {isLoading ? 'Loading…' : 'Reload'}
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov"
              multiple
              className="hidden"
              disabled={!canManage || uploadProgress !== null}
              onChange={(event) => void handleUpload(event.target.files)}
            />
            <Button
              type="button"
              className="w-auto px-6"
              disabled={!canManage || uploadProgress !== null}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload videos
            </Button>
            <p className="text-sm text-lanta-charcoal/60">
              {canManage
                ? 'A file with the same name replaces the one on the host.'
                : 'Upload stays off until FTP is connected.'}
            </p>
          </div>

          {uploadProgress ? (
            <p className="mt-3 text-sm text-lanta-charcoal" role="status">
              Uploading {uploadProgress.name} — {uploadPercent}%
            </p>
          ) : null}

          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by file name"
            className="mt-4 max-w-md"
          />

          {isLoading && videos.length === 0 ? (
            <p className="mt-6 text-sm text-lanta-charcoal/60">Loading videos…</p>
          ) : filteredVideos.length === 0 ? (
            <p className="mt-6 text-sm text-lanta-charcoal/60">No videos match this filter.</p>
          ) : (
            <ul className="mt-4 max-h-[36rem] space-y-2 overflow-y-auto">
              {filteredVideos.map((video) => {
                const isEditing = editingName === video.name
                return (
                  <li
                    key={video.name}
                    className="rounded-lg border border-lanta-sand px-4 py-3"
                  >
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <Input
                          value={nextName}
                          onChange={(event) => setNextName(event.target.value)}
                          className="min-w-[16rem] flex-1"
                        />
                        <Button
                          type="button"
                          className="w-auto px-4"
                          disabled={isRenaming || !nextName.trim()}
                          onClick={() => void handleRename(video.name)}
                        >
                          {isRenaming ? 'Saving…' : 'Save'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setEditingName(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <a
                          href={video.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            'min-w-0 flex-1 break-all text-sm font-medium text-lanta-charcoal',
                            'underline-offset-2 hover:underline',
                          )}
                        >
                          {video.name}
                        </a>
                        <span className="text-xs text-lanta-charcoal/50">
                          {formatBytes(video.bytes)}
                        </span>
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-auto px-4"
                          disabled={!canManage || uploadProgress !== null}
                          onClick={() => {
                            setEditingName(video.name)
                            setNextName(video.name)
                          }}
                        >
                          Rename
                        </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <p className="mt-3 text-sm text-lanta-charcoal/60">
            {filteredVideos.length} video{filteredVideos.length === 1 ? '' : 's'}
            {directory?.source === 'ftp' ? ' from the hosting folder' : ' known so far'}
          </p>
        </section>
      </div>
    </div>
  )
}
