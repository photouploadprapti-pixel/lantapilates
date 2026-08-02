type NetlifyHandlerResult = {
  statusCode: number
  headers?: Record<string, string>
  body?: string
  isBase64Encoded?: boolean
}

export type NetlifyHandler = (event: {
  httpMethod: string
  headers: Record<string, string | undefined>
  queryStringParameters: Record<string, string>
  body: string | null
}) => Promise<NetlifyHandlerResult>

/**
 * Adapts a Netlify-style function handler to a Web Fetch Response.
 *
 * @param handler - Netlify function handler
 * @param request - Incoming Next.js request
 */
export const invokeNetlifyHandler = async (
  handler: NetlifyHandler,
  request: Request,
): Promise<Response> => {
  const url = new URL(request.url)
  const body = request.method === 'GET' || request.method === 'HEAD'
    ? null
    : await request.text()

  const headers: Record<string, string | undefined> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  const result = await handler({
    httpMethod: request.method,
    headers,
    queryStringParameters: Object.fromEntries(url.searchParams.entries()),
    body,
  })

  const responseHeaders = new Headers(result.headers ?? {})
  if (!responseHeaders.has('Content-Type') && result.body) {
    responseHeaders.set('Content-Type', 'application/json')
  }

  if (result.isBase64Encoded && typeof result.body === 'string') {
    return new Response(Buffer.from(result.body, 'base64'), {
      status: result.statusCode,
      headers: responseHeaders,
    })
  }

  return new Response(result.body ?? '', {
    status: result.statusCode,
    headers: responseHeaders,
  })
}
