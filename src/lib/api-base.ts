/**
 * Returns the base URL for backend API routes.
 * Uses `/api` on deployed hosts (Vercel Route Handlers, Netlify redirects).
 * Locally, points at the functions server on port 8888.
 * Trailing slash is required because `trailingSlash: true` 308s bare paths.
 */
export const getApiBase = (): string => {
  if (typeof window === 'undefined') {
    return '/api'
  }

  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8888/api'
  }

  return '/api'
}

/**
 * Builds an API path that matches Next.js `trailingSlash: true` routing.
 *
 * @param path - Path under /api without a leading/trailing slash (e.g. admin-login)
 */
export const apiPath = (path: string): string => {
  const cleaned = path.replace(/^\/+|\/+$/g, '')
  return `${getApiBase()}/${cleaned}/`
}
