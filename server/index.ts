import express from 'express'
import { resolve } from 'node:path'
import { config as loadEnv } from 'dotenv'
import { createStore, verifyManifest } from './core.ts'
import { runAgentTurn } from './agent.ts'

loadEnv({ path: resolve(process.cwd(), '.env.local'), quiet: true })
const app = express()
app.use(express.json({ limit: '2mb' }))
const store = createStore(process.env.PROJECT_PLUS_DB ?? resolve(process.cwd(), 'data/project-plus.sqlite'))
const demoProjectId = store.seedDemo()
const port = Number(process.env.PORT ?? 3001)

function param(req: express.Request, name: string) { const value = req.params[name]; if (typeof value !== 'string') throw new Error(`Invalid ${name}`); return value }

function required(value: unknown, label: string, max = 10000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label} is required and must be shorter than ${max} characters`)
  return value.trim()
}

function route(handler: (req: express.Request, res: express.Response) => Promise<unknown> | unknown) {
  return async (req: express.Request, res: express.Response) => {
    try { const result = await handler(req, res); if (!res.headersSent) res.json(result) }
    catch (error) { res.status(error instanceof Error && /not found/i.test(error.message) ? 404 : 400).json({ error: error instanceof Error ? error.message : 'Unknown error' }) }
  }
}

app.get('/api/health', route(() => ({ ok: true, mode: process.env.MODEL_API_KEY ? 'model' : 'guided-demo', demoProjectId })))
app.get('/api/projects', route(() => ({ projects: store.all('SELECT * FROM projects ORDER BY created_at DESC') })))
app.post('/api/projects', route(req => store.createProject(required(req.body.name, 'name', 120), typeof req.body.description === 'string' ? req.body.description.slice(0, 2000) : '')))
app.get('/api/projects/:projectId', route(req => store.projectState(param(req, 'projectId'))))
app.get('/api/projects/:projectId/continuity', route(req => ({ summary: store.continuity(param(req, 'projectId')) })))
app.get('/api/projects/:projectId/manifest', route(req => store.exportManifest(param(req, 'projectId'))))
app.post('/api/verify-manifest', route(req => ({ valid: verifyManifest(req.body) })))
app.post('/api/projects/:projectId/items', route(req => store.addItem(param(req, 'projectId'), required(req.body.title, 'title', 200), required(req.body.criteria, 'criteria', 3000))))
app.post('/api/projects/:projectId/facts', route(req => store.addFact(param(req, 'projectId'), required(req.body.body, 'body', 1000))))
app.post('/api/projects/:projectId/documents', route(req => store.addDocument(param(req, 'projectId'), required(req.body.title, 'title', 200), required(req.body.body, 'body', 100000))))
app.get('/api/projects/:projectId/items/:itemId', route(req => store.itemDetail(param(req, 'projectId'), param(req, 'itemId'))))
app.post('/api/projects/:projectId/items/:itemId/analyze', route(req => store.analyzeItem(param(req, 'projectId'), param(req, 'itemId'))))
app.post('/api/projects/:projectId/items/:itemId/rfi', route(req => store.draftRfi(param(req, 'projectId'), param(req, 'itemId'))))
app.post('/api/projects/:projectId/rfis/:rfiId/approve', route(req => store.approveRfi(param(req, 'projectId'), param(req, 'rfiId'))))
app.post('/api/projects/:projectId/human-inputs/:inputId/resolve', route(req => store.resolveHumanInput(param(req, 'projectId'), param(req, 'inputId'), req.body.decision)))
app.post('/api/projects/:projectId/rfis/:rfiId/answer', route(req => store.answerRfi(param(req, 'projectId'), param(req, 'rfiId'), required(req.body.answer, 'answer', 10000))))
app.post('/api/projects/:projectId/items/:itemId/accept', route(req => store.acceptItem(param(req, 'projectId'), param(req, 'itemId'))))
app.post('/api/projects/:projectId/conversations', route(req => store.createConversation(param(req, 'projectId'), typeof req.body.title === 'string' ? req.body.title.slice(0, 100) : '新会话')))
app.get('/api/conversations/:conversationId', route(req => store.conversationState(param(req, 'conversationId'))))

app.post('/api/conversations/:conversationId/messages', route(async req => {
  const text = required(req.body.text, 'text', 5000)
  const conversation = store.conversationState(param(req, 'conversationId')).conversation
  const projectId = String(conversation.project_id)
  store.addMessage(param(req, 'conversationId'), 'user', text)
  let reply: string
  let mode: 'model' | 'guided-demo' | 'model-error'
  if (process.env.MODEL_API_KEY) {
    try { reply = await runAgentTurn(store, projectId, param(req, 'conversationId'), { endpoint: process.env.MODEL_API_URL ?? 'https://api.openai.com/v1/chat/completions', key: process.env.MODEL_API_KEY!, model: process.env.MODEL_NAME ?? 'gpt-4.1-mini' }); mode = 'model' }
    catch (error) { reply = `模型暂时不可用（${error instanceof Error ? error.message : '未知错误'}）。项目状态已保存，可以稍后继续。\n\n${store.continuity(projectId)}`; mode = 'model-error' }
  } else {
    const matches = store.retrieve(projectId, text, 2)
    const citations = matches.map(m => `• [${m.document_title}#${Number(m.position) + 1}] ${String(m.body).slice(0, 110)}`).join('\n')
    const facts = store.projectState(projectId).facts
    reply = `${store.continuity(projectId)}\n\n${facts.length ? `用户明确确认的项目约定：\n${facts.map(f => `• ${f.body}`).join('\n')}\n\n` : ''}${citations ? `相关资料片段（尚未人工核验）：\n${citations}` : '没有匹配到资料片段。可添加项目资料并运行验收项分析。'}\n\n这是无模型的规则演示。配置 MODEL_API_KEY 后可启用真实模型对话。`
    mode = 'guided-demo'
  }
  const message = store.addMessage(param(req, 'conversationId'), 'assistant', reply)
  return { message, mode }
}))

app.listen(port, '127.0.0.1', () => console.log(`Project+ AI API: http://127.0.0.1:${port} (${process.env.MODEL_API_KEY ? 'model' : 'guided-demo'})`))
