const getEnv = (key: string): string => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`)
  }
  return value
}

const createToken = (email: string): string => {
  const payload = Buffer.from(JSON.stringify({ email, iat: Date.now() })).toString('base64url')
  const signature = Buffer.from(`${payload}:${getEnv('ADMIN_TOKEN_SECRET')}`).toString('base64url')
  return `${payload}.${signature}`
}

/**
 * Validates admin credentials and returns a signed session token.
 */
export const handler = async (event: { httpMethod: string; body: string | null }) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  try {
    const { email, password } = JSON.parse(event.body ?? '{}') as {
      email?: string
      password?: string
    }

    const adminEmail = getEnv('ADMIN_EMAIL')
    const adminPassword = getEnv('ADMIN_PASSWORD')

    if (email !== adminEmail || password !== adminPassword) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Invalid email or password' }),
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ token: createToken(email ?? adminEmail) }),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed'
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: message }),
    }
  }
}
