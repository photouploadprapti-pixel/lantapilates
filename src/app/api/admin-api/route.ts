import { handler as adminApiHandler } from '../../../../netlify/functions/admin-api'
import {
  invokeNetlifyHandler,
  type NetlifyHandler,
} from '@/lib/server/invoke-netlify-handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const handler = adminApiHandler as unknown as NetlifyHandler

/**
 * Protected admin API for Vercel / Next.js (wraps the shared Netlify handler).
 *
 * @param request - Incoming admin action request
 */
export const POST = async (request: Request): Promise<Response> =>
  invokeNetlifyHandler(handler, request)

/**
 * CORS preflight for admin API.
 *
 * @param request - Incoming OPTIONS request
 */
export const OPTIONS = async (request: Request): Promise<Response> =>
  invokeNetlifyHandler(handler, request)
