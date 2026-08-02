import { handler as adminLoginHandler } from '../../../../netlify/functions/admin-login'
import {
  invokeNetlifyHandler,
  type NetlifyHandler,
} from '@/lib/server/invoke-netlify-handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const handler = adminLoginHandler as unknown as NetlifyHandler

/**
 * Admin login API for Vercel / Next.js (wraps the shared Netlify handler).
 *
 * @param request - Incoming login request
 */
export const POST = async (request: Request): Promise<Response> =>
  invokeNetlifyHandler(handler, request)

/**
 * CORS preflight for admin login.
 *
 * @param request - Incoming OPTIONS request
 */
export const OPTIONS = async (request: Request): Promise<Response> =>
  invokeNetlifyHandler(handler, request)
