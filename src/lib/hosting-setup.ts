/** Environment variables Vercel needs before the host folder can be managed. */
export const HOSTING_FTP_ENV_KEYS = [
  'HOSTING_FTP_HOST',
  'HOSTING_FTP_USER',
  'HOSTING_FTP_PASSWORD',
  'HOSTING_FTP_REMOTE_DIR',
] as const
