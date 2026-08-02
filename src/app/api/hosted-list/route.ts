import { handler as hostedListHandler } from '../../../../netlify/functions/hosted-list'
import {
  invokeNetlifyHandler,
  type NetlifyHandler,
} from '@/lib/server/invoke-netlify-handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const handler = hostedListHandler as unknown as NetlifyHandler

/**
 * Hosted MP4 catalog list API for Vercel / Next.js.
 *
 * @param request - Incoming catalog request
 */
export const GET = async (request: Request): Promise<Response> =>
  invokeNetlifyHandler(handler, request)

/**
 * CORS preflight for hosted catalog list.
 *
 * @param request - Incoming OPTIONS request
 */
export const OPTIONS = async (request: Request): Promise<Response> =>
  invokeNetlifyHandler(handler, request)
