/** Max bytes per Drive stream chunk (keeps Netlify function responses under platform limits). */
export const MAX_DRIVE_STREAM_CHUNK_BYTES = 2 * 1024 * 1024

type ParsedRange = {
  start: number
  end: number | null
  suffixLength?: number
}

/**
 * Parses an HTTP Range header (`bytes=…`).
 *
 * @param range - Raw Range header value
 */
const parseRangeHeader = (range: string): ParsedRange | null => {
  const match = range.trim().match(/^bytes=(\d*)-(\d*)$/i)
  if (!match) {
    return null
  }

  const [, startPart, endPart] = match

  if (!startPart && endPart) {
    const suffixLength = Number.parseInt(endPart, 10)
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null
    }
    return { start: 0, end: null, suffixLength }
  }

  const start = Number.parseInt(startPart || '0', 10)
  if (!Number.isFinite(start) || start < 0) {
    return null
  }

  if (!endPart) {
    return { start, end: null }
  }

  const end = Number.parseInt(endPart, 10)
  if (!Number.isFinite(end) || end < start) {
    return null
  }

  return { start, end }
}

/**
 * Formats a bounded byte range for upstream Drive requests.
 *
 * @param start - Range start (inclusive)
 * @param end - Range end (inclusive)
 */
export const formatByteRange = (start: number, end: number): string =>
  `bytes=${start}-${end}`

/**
 * Clamps open-ended or oversized Range requests to a safe chunk size.
 *
 * @param range - Optional client Range header
 */
export const clampDriveStreamRange = (range?: string): string => {
  if (!range) {
    return formatByteRange(0, MAX_DRIVE_STREAM_CHUNK_BYTES - 1)
  }

  const parsed = parseRangeHeader(range)
  if (!parsed) {
    return formatByteRange(0, MAX_DRIVE_STREAM_CHUNK_BYTES - 1)
  }

  if (parsed.suffixLength) {
    const suffix = Math.min(parsed.suffixLength, MAX_DRIVE_STREAM_CHUNK_BYTES)
    return `bytes=-${suffix}`
  }

  const start = parsed.start
  const requestedEnd = parsed.end ?? start + MAX_DRIVE_STREAM_CHUNK_BYTES - 1
  const span = requestedEnd - start + 1
  const end =
    span > MAX_DRIVE_STREAM_CHUNK_BYTES
      ? start + MAX_DRIVE_STREAM_CHUNK_BYTES - 1
      : requestedEnd

  return formatByteRange(start, end)
}
