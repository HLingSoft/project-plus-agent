import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
test('deployed proxy requires review access and checks allowed origin', async () => {
  const secret = 'synthetic-review-code-123456789'
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { env: { ...process.env, PORT: '0', VERCEL: '1', APP_ORIGIN: 'https://review.example', DEMO_ACCESS_CODE: secret, MODEL_API_KEY: 'synthetic' }, stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    const url = await new Promise<string>((resolve, reject) => { const timer = setTimeout(() => reject(new Error('startup timeout')), 10000); child.stdout.on('data', c => { const m = String(c).match(/http:\/\/127\.0\.0\.1:\d+/); if (m) { clearTimeout(timer); resolve(m[0]) } }) })
    const post = (path: string, data: unknown, headers: Record<string, string> = {}) => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://review.example', ...headers }, body: JSON.stringify(data) })
    assert.equal((await (await fetch(url + '/api/health')).json()).accessRequired, true)
    assert.equal((await post('/api/chat', {})).status, 401)
    assert.equal((await post('/api/access', { code: 'wrong' })).status, 401)
    assert.equal((await post('/api/access', { code: secret }, { Origin: 'https://evil.example' })).status, 403)
    const login = await post('/api/access', { code: secret }); assert.equal(login.status, 200)
    const cookie = login.headers.get('set-cookie')!; assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Strict/)
    const headers = { Cookie: cookie.split(';')[0] }
    assert.equal((await (await fetch(url + '/api/health', { headers })).json()).accessRequired, false)
    assert.equal((await post('/api/chat', {}, headers)).status, 400)
  } finally { child.kill() }
})
