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

const getFunctionsBase = (): string => {
  if (typeof window === 'undefined') {
    return '/.netlify/functions'
  }

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8888/.netlify/functions'
  }

  return '/.netlify/functions'
}

/**
 * Signs in with admin credentials via Netlify function.
 * @param email - Admin email
 * @param password - Admin password
 */
export const adminLogin = async (email: string, password: string): Promise<void> => {
  const response = await fetch(`${getFunctionsBase()}/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  const data = (await response.json()) as { token?: string; error?: string }
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

  const response = await fetch(`${getFunctionsBase()}/admin-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  const data = (await response.json()) as T & { error?: string }
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
