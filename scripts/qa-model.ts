// Deterministic QA-only OpenAI-compatible fixture. Never used by the normal app.
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
let requests = 0
const fixture = createServer(async (req, res) => {
  let body = ''; for await (const chunk of req) body += chunk
  const payload = JSON.parse(body); requests++
  const messages = payload.messages as { role: string; content: string; tool_calls?: { function: { name: string; arguments: string }; id: string }[] }[]
  const user = messages.findLast(m => m.role === 'user')?.content ?? ''
  const sinceUser = messages.slice(messages.findLastIndex(m => m.role === 'user') + 1)
  const previous = sinceUser.filter(m => m.role === 'assistant').flatMap(m => m.tool_calls ?? [])
  const done = previous.map(t => t.function.name)
  const toolResults = sinceUser.filter(m => m.role === 'tool').map(m => { try { return JSON.parse(m.content) } catch { return {} } })
  if (user.includes('测试错误')) { res.writeHead(503); res.end(JSON.stringify({ error: { message: 'QA simulated outage' } })); return }
  res.writeHead(200, { 'Content-Type': 'text/event-stream' })
  function chunk(delta: unknown, finish: string | null = null) { if (!res.destroyed) res.write(`data: ${JSON.stringify({ id: `qa-${requests}`, object: 'chat.completion.chunk', created: 1, model: 'qa-fixture', choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`) }
  async function text(value: string, interval = 60) { for (const piece of value.match(/[\s\S]{1,5}/g) ?? []) { if (res.destroyed) break; chunk({ content: piece }); await delay(interval) } }
  async function call(name: string, args: unknown) { await text(`正在${name === 'ask_human' ? '确认验收范围' : '推进验收任务'}。\n\n`); chunk({ tool_calls: [{ index: 0, id: `qa-call-${requests}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }] }); chunk({}, 'tool_calls') }
  if (user.includes('测试长回复')) {
    await text('## 流式显示测试\n\n'+Array.from({length:20},(_,i)=>`${i+1}. 已读取第 ${i+1} 项记录，等待你核对。\n`).join(''), 120); chunk({}, 'stop')
  } else if (user.includes('已确认 RFI') || user.includes('暂缓') || user.includes('中断')) {
    if (!done.includes('get_project_state')) await call('get_project_state', {})
    else { await text('## 当前进展\n\n已读取最新项目状态。**人工决定已保存**。\n\n| 工作 | 状态 |\n|---|---|\n| RFI 草稿 | 由你确认 |\n| 对外发送 | 等待人工处理 |\n\n这段回复来自本地 QA 模拟服务，用于验证界面与协议。'); chunk({}, 'stop') }
  } else if (user.includes('我的补充')) {
    if (!done.includes('list_items')) await call('list_items', {})
    else if (!done.includes('search_documents')) await call('search_documents', { query: '电视信号' })
    else if (!done.includes('analyze_item')) { const items = toolResults.find(Array.isArray) ?? []; await call('analyze_item', { item_id: items[0]?.id }) }
    else if (!done.includes('draft_rfi')) { const result = toolResults.find(x => x?.item); await call('draft_rfi', { item_id: result?.item.id }) }
    else { await text('等待你的确认。'); chunk({}, 'stop') }
  } else {
    if (!done.includes('get_project_state')) await call('get_project_state', {})
    else if (!done.includes('list_templates')) await call('list_templates', { query: '弱电' })
    else if (!done.includes('apply_template')) { const matches = toolResults.find(Array.isArray) ?? []; await call('apply_template', { template_id: matches[0]?.id }) }
    else if (!done.includes('list_items')) await call('list_items', {})
    else if (!done.includes('ask_human')) await call('ask_human', { question: '本地 QA 测试：这次先核验哪一项？', options: ['电视信号', '网络线路'] })
    else { await text('等待你补充。'); chunk({}, 'stop') }
  }
  if (!res.destroyed) res.end('data: [DONE]\n\n')
  console.log(JSON.stringify({ request: requests, user: user.slice(0,30), tools: done, responseClosed: res.destroyed }))
})
fixture.listen(3109, '127.0.0.1', () => console.log('QA model fixture on 3109'))
const proxy = spawn(process.execPath, ['--import','tsx','server/index.ts'], { stdio:'inherit', env:{...process.env, PORT:'3108', MODEL_API_KEY:'qa-fixture',MODEL_NAME:'qa-fixture',MODEL_API_URL:'http://127.0.0.1:3109/v1/chat/completions'} })
const web = spawn('npm',['run','dev:web','--','--port','5174','--strictPort'],{stdio:'inherit',env:{...process.env,PROJECT_API_URL:'http://127.0.0.1:3108'}})
function close() { proxy.kill(); web.kill(); fixture.closeAllConnections(); fixture.close(); process.exit() }
process.on('SIGTERM',close);process.on('SIGINT',close)
