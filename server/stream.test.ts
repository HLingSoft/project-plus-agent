import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'

test('AI SDK proxy emits UI text stream using a controlled model fixture', async () => {
  let tools: string[] = []
  const mock = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk
    tools = JSON.parse(body).tools.map((t: {function: {name: string}}) => t.function.name)
    res.writeHead(200, { 'Content-Type': 'text/event-stream' })
    for (const text of ['候选证据', '需要人工复核。']) res.write(`data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', created: 1, model: 'fixture', choices: [{ index: 0, delta: { content: text }, finish_reason: null }] })}\n\n`)
    res.end(`data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', created: 1, model: 'fixture', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`)
  })
  await new Promise<void>(resolve => mock.listen(0, '127.0.0.1', resolve))
  const addr = mock.address(); assert.ok(addr && typeof addr !== 'string')
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { env: { ...process.env, PORT: '0', DEMO_ACCESS_CODE: '', VERCEL: '', MODEL_API_KEY: 'test-fixture', MODEL_API_URL: `http://127.0.0.1:${addr.port}/v1/chat/completions`, MODEL_NAME: 'fixture' }, stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    const url = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('proxy startup timed out')), 10000)
      child.stdout.on('data', chunk => { const match = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); resolve(match[0]) } })
      child.once('exit', () => { clearTimeout(timer); reject(new Error('proxy exited')) })
    })
    const response = await fetch(`${url}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ id: 'one', role: 'user', parts: [{ type: 'text', text: '请核验' }] }], context: { name: 'fixture' } }) })
    assert.equal(response.status, 200)
    const output = await response.text()
    assert.match(output, /text-delta/); assert.match(output, /候选证据/); assert.match(output, /需要人工复核/); assert.match(output, /\[DONE\]/)
    assert.deepEqual(tools.sort(), ['analyze_item', 'apply_template', 'ask_human', 'draft_rfi', 'get_project_state', 'list_items', 'list_templates', 'search_documents', 'search_history'])
    const denied = await fetch(`${url}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://external.example' }, body: '{}' }); assert.equal(denied.status, 403)
  } finally { child.kill(); mock.closeAllConnections(); await new Promise<void>(resolve => mock.close(() => resolve())) }
})
