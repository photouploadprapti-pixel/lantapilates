import { apiPath } from '@/lib/api-base'

const ADMIN_TOKEN_KEY = 'lanta-admin-token'

/**
 * Persists the admin session token in session storage.
 * @param token - Signed token from admin login
 */
export const saveAdminToken = (token: string): void => {
  if (typeof window === 'undefined') {
    return
  }
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token)
}

/**
 * Reads the admin session token.
 */
export const loadAdminToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null
  }
  return sessionStorage.getItem(ADMIN_TOKEN_KEY)
}

/**
 * Clears the admin session token.
 */
export const clearAdminToken = (): void => {
  if (typeof window === 'undefined') {
    return
  }
  sessionStorage.removeItem(ADMIN_TOKEN_KEY)
}

/**
 * Returns true when an admin token is stored locally.
 */
export const isAdminAuthenticated = (): boolean => Boolean(loadAdminToken())

/**
 * Parses a JSON API response, surfacing HTML/non-JSON failures clearly.
 *
 * @param response - Fetch response
 */
const readJsonResponse = async <T>(response: Response): Promise<T> => {
  const contentType = response.headers.get('content-type') ?? ''
  const text = await response.text()

  if (!contentType.includes('application/json')) {
    throw new Error(
      response.ok
        ? 'Admin API returned a non-JSON response. Check deployment API routes.'
        : `Admin API error (${response.status}). Is the server configured?`,
    )
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('Admin API returned invalid JSON')
  }
}

/**
 * Signs in with admin credentials via the admin-login API.
 * @param email - Admin email
 * @param password - Admin password
 */
export const adminLogin = async (email: string, password: string): Promise<void> => {
  const response = await fetch(apiPath('admin-login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  const data = await readJsonResponse<{ token?: string; error?: string }>(response)
  if (!response.ok || !data.token) {
    throw new Error(data.error ?? 'Login failed')
  }

  saveAdminToken(data.token)
}

/**
 * Calls the protected admin API.
 * @param payload - Action payload
 */
export const adminApi = async <T>(payload: Record<string, unknown>): Promise<T> => {
  const token = loadAdminToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(apiPath('admin-api'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  const data = await readJsonResponse<T & { error?: string }>(response)
  if (!response.ok) {
    throw new Error(data.error ?? 'Request failed')
  }

  return data
}

/**
 * Signs out the admin session.
 */
export const adminLogout = (): void => {
  clearAdminToken()
}
