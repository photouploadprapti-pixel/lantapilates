import pg from 'pg'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const getConnectionString = (): string => {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('Missing environment variable: DATABASE_URL')
  }
  return connectionString
}

const sql = readFileSync(join(__dirname, '../../supabase/schema.sql'), 'utf8')

/**
 * One-time schema bootstrap for Supabase (run manually or during deploy).
 */
export const handler = async () => {
  const client = new pg.Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    await client.query(sql)
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, message: 'Schema applied successfully' }),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Setup failed'
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: message }),
    }
  } finally {
    await client.end()
  }
}
