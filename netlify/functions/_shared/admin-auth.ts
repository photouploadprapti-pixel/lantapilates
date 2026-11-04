/**
 * Reads a bearer token from an Authorization header.
 *
 * @param header - Raw Authorization header value
 */
export const parseBearerToken = (header: string | undefined): string | null => {
  if (!header?.startsWith('Bearer ')) {
    return null
  }
  return header.slice(7)
}

/**
 * Checks an admin session token signed with ADMIN_TOKEN_SECRET.
 *
 * @param token - Raw bearer token, or null when the header was missing
 */
export const verifyAdminToken = (token: string | null): boolean => {
  if (!token) {
    return false
  }

  const secret = process.env.ADMIN_TOKEN_SECRET
  if (!secret) {
    throw new Error('Missing environment variable: ADMIN_TOKEN_SECRET')
  }

  const parts = token.split('.')
  if (parts.length !== 2) {
    return false
  }

  const [payloadB64, signature] = parts
  const expected = Buffer.from(`${payloadB64}:${secret}`).toString('base64url')
  return signature === expected
}
