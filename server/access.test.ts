import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accessToken, hasAccess, equalSecret, cookieName } from './access.ts'
test('review access rejects absent, forged, expired and rotated cookies', () => {
  const secret = 'unit-test-only-secret-long-enough'; const now = Date.now()
  const req = (token: string) => ({ headers: { cookie: `${cookieName}=${token}` } })
  assert.equal(hasAccess({ headers: {} }, secret, now), false)
  assert.equal(hasAccess(req(accessToken(secret, now)), secret, now), true)
  assert.equal(hasAccess(req(accessToken(secret, now - 86400001)), secret, now), false)
  assert.equal(hasAccess(req(accessToken(secret, now) + 'x'), secret, now), false)
  assert.equal(hasAccess(req(accessToken(secret, now)), 'rotated-secret', now), false)
  assert.equal(equalSecret(secret, ''), false)
})
