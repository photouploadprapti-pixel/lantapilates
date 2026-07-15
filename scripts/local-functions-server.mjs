import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Loads KEY=VALUE pairs from .env.local into process.env (without overwriting).
 * @param {string} filePath
 */
const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) {
    return
  }

  const content = readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex <= 0) {
      continue
    }

    const key = trimmed.slice(0, equalsIndex).trim()
    let value = trimmed.slice(equalsIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'))

const port = Number(process.env.LOCAL_FUNCTIONS_PORT ?? 8888)
const root = process.cwd()

/**
 * @param {import('node:http').IncomingMessage} req
 */
const readBody = async (req) => {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  if (chunks.length === 0) {
    return null
  }

  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Dynamically loads a Netlify function handler.
 * @param {string} relativePath
 */
const loadHandler = async (relativePath) => {
  const fileUrl = pathToFileURL(resolve(root, relativePath)).href
  const mod = await import(fileUrl)
  return mod.handler
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = req.url ?? ''
  const body = await readBody(req)
  const event = {
    httpMethod: req.method ?? 'GET',
    headers: Object.fromEntries(
      Object.entries(req.headers).map(([key, value]) => [
        key,
        Array.isArray(value) ? value[0] : value,
      ]),
    ),
    body,
  }

  try {
    let result

    if (url.includes('admin-login')) {
      const handler = await loadHandler('netlify/functions/admin-login.ts')
      result = await handler(event)
    } else if (url.includes('admin-api')) {
      const handler = await loadHandler('netlify/functions/admin-api.ts')
      result = await handler(event)
    } else {
      result = {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Not found' }),
      }
    }

    res.writeHead(result.statusCode, result.headers ?? {})
    res.end(result.body ?? '')
  } catch (error) {
    console.error(error)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Server error',
      }),
    )
  }
})

server.listen(port, () => {
  console.log(`Local admin functions ready on http://localhost:${port}`)
  console.log('  POST /.netlify/functions/admin-login')
  console.log('  POST /.netlify/functions/admin-api')
})
