import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Request } from 'express'
const cookieName = 'project_plus_access'
function signature(value: string, secret: string) { return createHmac('sha256', secret).update(value).digest('hex') }
export function equalSecret(a: string, b: string) { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y) }
export function accessToken(secret: string, now = Date.now()) { const expiry = String(now + 24 * 60 * 60 * 1000); return `${expiry}.${signature(expiry, secret)}` }
export function hasAccess(req: Pick<Request, 'headers'>, secret: string, now = Date.now()) {
  const token = (req.headers.cookie ?? '').split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1)
  if (!token) return false
  const [expiry, sig, extra] = token.split('.')
  return !extra && Number(expiry) > now && Number(expiry) <= now + 24 * 60 * 60 * 1000 && equalSecret(sig ?? '', signature(expiry, secret))
}
export { cookieName }
