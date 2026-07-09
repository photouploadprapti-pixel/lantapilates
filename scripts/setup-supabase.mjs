import pg from 'pg'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('Missing DATABASE_URL environment variable.')
  process.exit(1)
}

const sql = readFileSync(join(__dirname, '../supabase/schema.sql'), 'utf8')

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()
  await client.query(sql)
  console.log('Supabase schema applied successfully.')
} catch (error) {
  console.error('Failed to apply schema:', error)
  process.exit(1)
} finally {
  await client.end()
}
