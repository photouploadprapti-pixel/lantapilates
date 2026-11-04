import { Readable } from 'node:stream'

import { Client, type FileInfo } from 'basic-ftp'

const VIDEO_NAME = /\.(mp4|m4v|webm|mov)$/i

const DEFAULT_DIRS = [
  '/public_html/LantaVideos',
  '/LantaVideos',
  'public_html/LantaVideos',
  'LantaVideos',
]

export type HostingVideoEntry = {
  name: string
  bytes: number
  modifiedAt: string | null
}

type HostingFtpConfig = {
  host: string
  port: number
  user: string
  password: string
  secure: boolean | 'implicit'
  remoteDir: string | null
  allowSeparateTransferHost: boolean
}

/**
 * Reads FTP settings. Returns null until the host, user, and password are set.
 */
export const readHostingFtpConfig = (): HostingFtpConfig | null => {
  const host = process.env.HOSTING_FTP_HOST?.trim() ?? ''
  const user = process.env.HOSTING_FTP_USER?.trim() ?? ''
  const password = process.env.HOSTING_FTP_PASSWORD ?? ''
  if (!host || !user || !password) {
    return null
  }

  const secureRaw = (process.env.HOSTING_FTP_SECURE ?? 'true').trim().toLowerCase()
  const secure = secureRaw === 'implicit'
    ? 'implicit'
    : secureRaw !== 'false'
  const fallbackPort = secure === 'implicit' ? 990 : 21
  const port = Number(process.env.HOSTING_FTP_PORT ?? fallbackPort)
  const remoteDir = process.env.HOSTING_FTP_REMOTE_DIR?.trim() || null

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : fallbackPort,
    user,
    password,
    secure,
    remoteDir,
    allowSeparateTransferHost: process.env.HOSTING_FTP_ALLOW_SEPARATE_HOST === 'true',
  }
}

/**
 * Returns true when the variables required for FTP listing and upload are present.
 */
export const isHostingFtpConfigured = (): boolean => readHostingFtpConfig() !== null

/**
 * Keeps a single video file name and rejects paths.
 *
 * @param value - Proposed file name from the admin UI or an upload
 */
export const sanitizeVideoFileName = (value: string): string => {
  const name = value.trim().replace(/\\/g, '/').split('/').pop()?.trim() ?? ''
  if (!name || name === '.' || name === '..' || name.includes('\0')) {
    throw new Error('Enter a video file name')
  }
  if (name.length > 180) {
    throw new Error('File name is too long')
  }
  if (!VIDEO_NAME.test(name)) {
    throw new Error('File name must end in .mp4, .m4v, .webm, or .mov')
  }
  return name
}

/**
 * Joins an FTP directory and a file name with a forward slash.
 *
 * @param dir - Remote directory
 * @param name - File name
 */
const joinPosix = (dir: string, name: string): string => {
  const base = dir.endsWith('/') ? dir.slice(0, -1) : dir
  return `${base}/${name}`
}

/**
 * Opens the LantaVideos folder, using HOSTING_FTP_REMOTE_DIR when it is set.
 *
 * @param client - Connected FTP client
 * @param preferred - Explicit remote directory, or null to try the usual paths
 */
const resolveRemoteDir = async (
  client: Client,
  preferred: string | null,
): Promise<string> => {
  const candidates = preferred ? [preferred] : DEFAULT_DIRS
  const errors: string[] = []

  for (const dir of candidates) {
    try {
      await client.cd(dir)
      return await client.pwd()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not open folder'
      errors.push(message)
    }
  }

  if (preferred) {
    throw new Error(`Could not open ${preferred}. ${errors[0] ?? ''}`.trim())
  }

  throw new Error(
    'Could not find LantaVideos. Set HOSTING_FTP_REMOTE_DIR to its FTP path, '
    + 'usually /public_html/LantaVideos.',
  )
}

/**
 * Adds the app's FTP setting name when the server asks for a separate data host.
 *
 * @param error - Failure from the FTP client
 */
const annotateFtpError = (error: unknown): Error => {
  const message = error instanceof Error ? error.message : 'FTP request failed'
  if (message.includes('allowSeparateTransferHost')) {
    return new Error(
      `${message} Set HOSTING_FTP_ALLOW_SEPARATE_HOST=true if this server requires it.`,
    )
  }
  return error instanceof Error ? error : new Error(message)
}

/**
 * Runs one FTP session and always closes the control connection.
 *
 * @param work - Callback that receives the open client and the video folder
 */
const withClient = async <T>(
  work: (client: Client, remoteDir: string) => Promise<T>,
): Promise<T> => {
  const config = readHostingFtpConfig()
  if (!config) {
    throw new Error(
      'Hosting FTP is not configured. Set HOSTING_FTP_HOST, HOSTING_FTP_USER, '
      + 'and HOSTING_FTP_PASSWORD.',
    )
  }

  const client = new Client(60_000, {
    allowSeparateTransferHost: config.allowSeparateTransferHost,
  })

  try {
    try {
      await client.access({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        secure: config.secure,
      })
      const remoteDir = await resolveRemoteDir(client, config.remoteDir)
      return await work(client, remoteDir)
    } catch (error) {
      throw annotateFtpError(error)
    }
  } finally {
    client.close()
  }
}

/**
 * Returns true when a listing entry is a video file in this folder.
 *
 * @param item - One FTP directory entry
 */
const isVideoEntry = (item: FileInfo): boolean => {
  if (item.isDirectory || !item.name || item.name.includes('/') || item.name.includes('..')) {
    return false
  }
  return VIDEO_NAME.test(item.name)
}

/**
 * Lists video files in the hosting folder over FTP.
 */
export const listHostingVideos = async (): Promise<HostingVideoEntry[]> =>
  withClient(async (client, remoteDir) => {
    const items = await client.list(remoteDir)
    return items
      .filter(isVideoEntry)
      .map((item) => ({
        name: item.name,
        bytes: item.size,
        modifiedAt: item.modifiedAt ? item.modifiedAt.toISOString() : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  })

/**
 * Renames a video inside the hosting folder.
 *
 * @param fromName - Current file name
 * @param toName - New file name
 */
export const renameHostingVideo = async (
  fromName: string,
  toName: string,
): Promise<void> => {
  const from = sanitizeVideoFileName(fromName)
  const to = sanitizeVideoFileName(toName)
  if (from === to) {
    return
  }

  await withClient(async (client, remoteDir) => {
    await client.rename(joinPosix(remoteDir, from), joinPosix(remoteDir, to))
  })
}

/**
 * Writes one chunk of a video. Index 0 creates or replaces the file.
 *
 * @param fileName - Destination file name
 * @param chunkIndex - Zero-based chunk index
 * @param chunk - Chunk bytes
 */
export const uploadHostingChunk = async (
  fileName: string,
  chunkIndex: number,
  chunk: Buffer,
): Promise<void> => {
  const safeName = sanitizeVideoFileName(fileName)
  if (chunk.length === 0) {
    throw new Error('Upload chunk was empty')
  }

  await withClient(async (client, remoteDir) => {
    const remotePath = joinPosix(remoteDir, safeName)
    const source = Readable.from(chunk)
    if (chunkIndex === 0) {
      await client.uploadFrom(source, remotePath)
      return
    }
    await client.appendFrom(source, remotePath)
  })
}
