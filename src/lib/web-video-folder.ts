import { isMpegTsFileName, isVideoFileName, titleFromFileName } from '@/lib/local-video-catalog'
import type { LocalVideoFile } from '@/plugins/local-videos/definitions'

const DB_NAME = 'lanta-video-folder'
const STORE_NAME = 'handles'
const CLIENT_HANDLE_KEY = 'directory'
const META_KEY = 'lanta-video-folder-meta'

type FolderMeta = {
  folderName: string
  fileNames: string[]
}

type PermissionedDirectoryHandle = FileSystemDirectoryHandle & {
  entries: () => AsyncIterableIterator<[string, FileSystemHandle]>
  queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
  requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite'
  }) => Promise<PermissionedDirectoryHandle>
}

/**
 * Opens IndexedDB used to persist the web directory handle.
 */
const openHandleDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open folder storage'))
  })

/**
 * Saves the selected directory handle for later sessions (Chromium).
 *
 * @param handle - Directory handle from showDirectoryPicker
 */
export const saveDirectoryHandle = async (handle: PermissionedDirectoryHandle): Promise<void> => {
  const db = await openHandleDb()

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(handle, CLIENT_HANDLE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not save folder handle'))
  })

  db.close()
}

/**
 * Loads a previously persisted directory handle.
 */
export const loadDirectoryHandle = async (): Promise<PermissionedDirectoryHandle | null> => {
  const db = await openHandleDb()

  const handle = await new Promise<PermissionedDirectoryHandle | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(CLIENT_HANDLE_KEY)
    request.onsuccess = () =>
      resolve((request.result as PermissionedDirectoryHandle | undefined) ?? null)
    request.onerror = () => reject(request.error ?? new Error('Could not load folder handle'))
  })

  db.close()
  return handle
}

/**
 * Clears the persisted directory handle and folder metadata.
 */
export const clearDirectoryHandle = async (): Promise<void> => {
  const db = await openHandleDb()

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(CLIENT_HANDLE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not clear folder handle'))
  })

  db.close()
  window.localStorage.removeItem(META_KEY)
}

/**
 * Persists folder display metadata (names only) for offline UI.
 *
 * @param meta - Folder name + scanned file names
 */
export const saveFolderMeta = (meta: FolderMeta): void => {
  window.localStorage.setItem(META_KEY, JSON.stringify(meta))
}

/**
 * Loads cached folder metadata.
 */
export const loadFolderMeta = (): FolderMeta | null => {
  const raw = window.localStorage.getItem(META_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as FolderMeta
  } catch {
    return null
  }
}

/**
 * Requests read permission for a stored directory handle when required.
 *
 * @param handle - Directory handle
 */
const ensureDirectoryPermission = async (
  handle: PermissionedDirectoryHandle,
): Promise<boolean> => {
  if (handle.queryPermission) {
    const current = await handle.queryPermission({ mode: 'read' })
    if (current === 'granted') {
      return true
    }
  }

  if (handle.requestPermission) {
    const next = await handle.requestPermission({ mode: 'read' })
    return next === 'granted'
  }

  return true
}

/**
 * Lists video files from a directory handle (supports nested folders).
 *
 * @param handle - Root directory handle
 * @param createBlobUrls - When false, only file names are collected
 */
export const listVideosFromDirectoryHandle = async (
  handle: PermissionedDirectoryHandle,
  createBlobUrls = true,
): Promise<LocalVideoFile[]> => {
  const videos: LocalVideoFile[] = []

  const walk = async (dir: PermissionedDirectoryHandle, prefix = '') => {
    for await (const [name, entry] of dir.entries()) {
      if (entry.kind === 'directory') {
        await walk(entry as PermissionedDirectoryHandle, `${prefix}${name}/`)
        continue
      }

      if (!isVideoFileName(name)) {
        continue
      }

      let playbackUrl = ''
      if (createBlobUrls) {
        const fileHandle = entry as FileSystemFileHandle
        const file = await fileHandle.getFile()
        // Browsers often leave MPEG-TS with an empty MIME type; tag it for mse players.
        const playbackFile =
          isMpegTsFileName(name) && !file.type
            ? new File([file], name, { type: 'video/mp2t' })
            : file
        playbackUrl = URL.createObjectURL(playbackFile)
      }

      videos.push({
        id: `${prefix}${name}`,
        name,
        playbackUrl,
      })
    }
  }

  await walk(handle)
  videos.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
  return videos
}

/**
 * Opens a directory picker and lists video file names without saving as the client folder.
 * Used by the admin dashboard to build the assignable catalog.
 */
export const scanAdminDirectory = async (): Promise<{
  folderName: string
  videos: LocalVideoFile[]
}> => {
  const pickerWindow = window as DirectoryPickerWindow
  if (!pickerWindow.showDirectoryPicker) {
    throw new Error('Folder selection is not supported in this browser. Use Chrome or Edge.')
  }

  const handle = await pickerWindow.showDirectoryPicker({ mode: 'read' })
  const videos = await listVideosFromDirectoryHandle(handle, false)
  const folderName = handle.name || 'Selected folder'

  return { folderName, videos }
}

/**
 * Opens the native directory picker and persists it as the client video folder.
 */
export const pickWebDirectory = async (): Promise<{
  folderName: string
  videos: LocalVideoFile[]
}> => {
  const pickerWindow = window as DirectoryPickerWindow
  if (!pickerWindow.showDirectoryPicker) {
    throw new Error('Folder selection is not supported in this browser. Use Chrome or Edge.')
  }

  const handle = await pickerWindow.showDirectoryPicker({ mode: 'read' })
  await saveDirectoryHandle(handle)
  const videos = await listVideosFromDirectoryHandle(handle, true)
  const folderName = handle.name || 'Selected folder'

  saveFolderMeta({
    folderName,
    fileNames: videos.map((video) => video.name),
  })

  return { folderName, videos }
}

/**
 * Restores videos from a previously selected directory handle.
 */
export const restoreWebDirectoryVideos = async (): Promise<{
  folderName: string
  videos: LocalVideoFile[]
} | null> => {
  const handle = await loadDirectoryHandle()
  if (!handle) {
    const meta = loadFolderMeta()
    if (!meta) {
      return null
    }

    return {
      folderName: meta.folderName,
      videos: meta.fileNames.map((name) => ({
        id: name,
        name,
        playbackUrl: '',
      })),
    }
  }

  const allowed = await ensureDirectoryPermission(handle)
  if (!allowed) {
    return null
  }

  const videos = await listVideosFromDirectoryHandle(handle, true)
  const folderName = handle.name || loadFolderMeta()?.folderName || 'Selected folder'
  saveFolderMeta({
    folderName,
    fileNames: videos.map((video) => video.name),
  })

  return { folderName, videos }
}

/**
 * Maps local files to playlist entries for the native HTML5 player.
 *
 * @param files - Local video files with playback URLs
 */
export const toPlaylistVideos = (files: LocalVideoFile[]) =>
  files
    .filter((file) => Boolean(file.playbackUrl))
    .map((file) => ({
      id: file.id,
      title: titleFromFileName(file.name),
      src: file.playbackUrl,
      fileName: file.name,
    }))
