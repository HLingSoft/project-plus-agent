import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

export type ItemStatus = 'not_started' | 'needs_evidence' | 'awaiting_rfi' | 'ready_for_review' | 'accepted'
export type TaskStatus = 'active' | 'waiting_human' | 'ready_for_review' | 'completed'

type Row = Record<string, unknown>
type ChunkRow = { id: string; document_id: string; body: string; position: number; document_title: string; source_type: string }
type ItemRow = { id: string; project_id: string; title: string; criteria: string; status: ItemStatus; created_at: string }
const now = () => new Date().toISOString()
const id = () => randomUUID()
const sha256 = (value: string) => `0x${createHash('sha256').update(value).digest('hex')}`

export function verifyManifest(input: { payload: unknown; root: string }) {
  return sha256(JSON.stringify(input.payload)) === input.root
}

export function createStore(filename: string) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true })
  const db = new DatabaseSync(filename)
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), title TEXT NOT NULL, criteria TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'not_started', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), title TEXT NOT NULL, body TEXT NOT NULL, source_type TEXT NOT NULL DEFAULT 'document', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS chunks (id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id), project_id TEXT NOT NULL REFERENCES projects(id), position INTEGER NOT NULL, body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), title TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id), role TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS facts (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), body TEXT NOT NULL, source_type TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), item_id TEXT NOT NULL UNIQUE REFERENCES items(id), status TEXT NOT NULL, checkpoint TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS evidence (id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id), chunk_id TEXT NOT NULL REFERENCES chunks(id), score REAL NOT NULL, UNIQUE(item_id, chunk_id));
    CREATE TABLE IF NOT EXISTS rfis (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), item_id TEXT NOT NULL REFERENCES items(id), question TEXT NOT NULL, answer TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL, answered_at TEXT);
    CREATE TABLE IF NOT EXISTS human_inputs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), item_id TEXT NOT NULL REFERENCES items(id), rfi_id TEXT NOT NULL REFERENCES rfis(id), question TEXT NOT NULL, status TEXT NOT NULL, decision TEXT, created_at TEXT NOT NULL, resolved_at TEXT);
    CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), item_id TEXT, kind TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_items_project ON items(project_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_project ON chunks(project_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
  `)

  const all = (sql: string, ...values: (string | number | null)[]) => db.prepare(sql).all(...values) as Row[]
  const get = (sql: string, ...values: (string | number | null)[]) => db.prepare(sql).get(...values) as Row | undefined
  const run = (sql: string, ...values: (string | number | null)[]) => db.prepare(sql).run(...values)
  const projectExists = (projectId: string) => Boolean(get('SELECT id FROM projects WHERE id = ?', projectId))
  const addEvent = (projectId: string, itemId: string | null, kind: string, detail: string) => run('INSERT INTO events VALUES (?, ?, ?, ?, ?, ?)', id(), projectId, itemId, kind, detail, now())

  function createProject(name: string, description = '') {
    const project = { id: id(), name, description, created_at: now() }
    run('INSERT INTO projects VALUES (?, ?, ?, ?)', project.id, project.name, project.description, project.created_at)
    return project
  }

  function addItem(projectId: string, title: string, criteria: string) {
    if (!projectExists(projectId)) throw new Error('Project not found')
    const item = { id: id(), project_id: projectId, title, criteria, status: 'not_started' as ItemStatus, created_at: now() }
    run('INSERT INTO items VALUES (?, ?, ?, ?, ?, ?)', item.id, item.project_id, item.title, item.criteria, item.status, item.created_at)
    addEvent(projectId, item.id, 'item_created', `新增验收项：${title}`)
    return item
  }

  function addDocument(projectId: string, title: string, body: string, sourceType = 'document') {
    if (!projectExists(projectId)) throw new Error('Project not found')
    const document = { id: id(), project_id: projectId, title, body, source_type: sourceType, created_at: now() }
    const paragraphs = body.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean)
    const chunks = paragraphs.flatMap(paragraph => paragraph.length <= 700 ? [paragraph] : paragraph.match(/[\s\S]{1,700}/g) ?? [])
    db.exec('BEGIN')
    try {
      run('INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?)', document.id, projectId, title, body, sourceType, document.created_at)
      chunks.forEach((text, position) => run('INSERT INTO chunks VALUES (?, ?, ?, ?, ?)', id(), document.id, projectId, position, text))
      addEvent(projectId, null, 'document_added', `添加资料：${title}`)
      db.exec('COMMIT')
    } catch (error) { db.exec('ROLLBACK'); throw error }
    return { ...document, chunk_count: chunks.length }
  }

  function tokens(input: string) {
    const normalized = input.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')
    const words = normalized.match(/[a-z0-9]{2,}/g) ?? []
    const han = normalized.match(/[\p{Script=Han}]+/gu) ?? []
    const grams = han.flatMap(word => word.length < 2 ? [word] : Array.from({ length: word.length - 1 }, (_, i) => word.slice(i, i + 2)))
    return new Set([...words, ...grams])
  }

  function retrieve(projectId: string, query: string, limit = 4) {
    const queryTokens = tokens(query)
    const rows = all(`SELECT c.id, c.document_id, c.body, c.position, d.title AS document_title, d.source_type
      FROM chunks c JOIN documents d ON d.id = c.document_id WHERE c.project_id = ?`, projectId) as unknown as ChunkRow[]
    const scored = rows.map(row => {
      const bodyTokens = tokens(String(row.body))
      const overlap = [...queryTokens].filter(t => bodyTokens.has(t)).length
      const score = queryTokens.size ? overlap / queryTokens.size : 0
      return { ...row, score }
    })
    const bestByDocument = new Map<string, number>()
    scored.forEach(row => bestByDocument.set(String(row.document_id), Math.max(bestByDocument.get(String(row.document_id)) ?? 0, row.score)))
    return scored.filter(row => (bestByDocument.get(String(row.document_id)) ?? 0) >= 0.25 && (row.score >= 0.15 || /未记录|未提供|未完成|待补|缺少|待确认|尚未/.test(String(row.body))))
      .sort((a, b) => b.score - a.score).slice(0, limit)
  }

  function analyzeItem(projectId: string, itemId: string) {
    const item = get('SELECT * FROM items WHERE id = ? AND project_id = ?', itemId, projectId)
    if (!item) throw new Error('Acceptance item not found')
    if (item.status === 'accepted') throw new Error('Accepted item is locked')
    if (get('SELECT id FROM rfis WHERE item_id = ? AND status = ?', itemId, 'open')) return itemDetail(projectId, itemId)
    if (get('SELECT id FROM human_inputs WHERE item_id = ? AND status = ?', itemId, 'pending')) return itemDetail(projectId, itemId)
    const matches = retrieve(projectId, `${item.title} ${item.criteria}`)
    const response = get('SELECT * FROM rfis WHERE item_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1', itemId, 'answered')
    const hasEvidence = matches.some(match => match.score >= 0.25)
    const gapSignals = matches.some(match => /未记录|未提供|未完成|待补|缺少|待确认|尚未/.test(String(match.body)))
    // Retrieval is a candidate source, never proof that the acceptance criterion is met.
    const status: ItemStatus = response ? 'ready_for_review' : hasEvidence && !gapSignals ? 'ready_for_review' : 'needs_evidence'
    const checkpoint = response ? '已收到 RFI 回复；仍需人工核对回复与验收标准。'
      : gapSignals ? `找到 ${matches.length} 条候选证据，但资料明确提到未完成或待补内容；建议发起 RFI。`
      : hasEvidence ? `找到 ${matches.length} 条候选证据；需要人工检查原文是否满足验收标准。`
      : '尚无足够相关证据；建议向负责人发起 RFI。'
    db.exec('BEGIN')
    try {
      run('DELETE FROM evidence WHERE item_id = ?', itemId)
      matches.forEach(match => run('INSERT INTO evidence VALUES (?, ?, ?, ?)', id(), itemId, String(match.id), Number(match.score)))
      run('UPDATE items SET status = ? WHERE id = ?', status, itemId)
      run(`INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(item_id) DO UPDATE SET status=excluded.status, checkpoint=excluded.checkpoint, updated_at=excluded.updated_at`,
        id(), projectId, itemId, status === 'needs_evidence' ? 'active' : 'ready_for_review', checkpoint, now())
      addEvent(projectId, itemId, 'analysis', checkpoint)
      db.exec('COMMIT')
    } catch (error) { db.exec('ROLLBACK'); throw error }
    return itemDetail(projectId, itemId)
  }

  function draftRfi(projectId: string, itemId: string) {
    const item = get('SELECT * FROM items WHERE id = ? AND project_id = ?', itemId, projectId)
    if (!item) throw new Error('Acceptance item not found')
    if (item.status === 'accepted') throw new Error('Accepted item is locked')
    const existing = get(`SELECT * FROM rfis WHERE item_id = ? AND status IN ('draft', 'open') ORDER BY created_at DESC LIMIT 1`, itemId)
    if (existing) return existing
    const criteria = String(item.criteria).replace(/[。.!！?？]+$/, '')
    const gap = retrieve(projectId, `${item.title} ${criteria}`).find(match => /未记录|未提供|未完成|待补|缺少|待确认|尚未/.test(String(match.body)))
    const question = `关于“${item.title}”，请提供能够证明以下验收标准的资料或说明：${criteria}。${gap ? `现有资料提示“${String(gap.body).slice(0, 160)}”，请说明补充情况。` : ''}请注明文件名称、版本、日期和责任人。`
    const rfi = { id: id(), project_id: projectId, item_id: itemId, question, answer: null, status: 'draft', created_at: now(), answered_at: null }
    db.exec('BEGIN')
    try {
      run('INSERT INTO rfis VALUES (?, ?, ?, ?, ?, ?, ?, ?)', rfi.id, projectId, itemId, question, null, 'draft', rfi.created_at, null)
      run('INSERT INTO human_inputs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', id(), projectId, itemId, rfi.id, '是否确认这份 RFI 草稿，并将任务标记为等待人工发送与回复？', 'pending', null, now(), null)
      run(`INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(item_id) DO UPDATE SET status=excluded.status, checkpoint=excluded.checkpoint, updated_at=excluded.updated_at`, id(), projectId, itemId, 'waiting_human', 'RFI 草稿已生成；等待你的决定。', now())
      addEvent(projectId, itemId, 'rfi_drafted', 'RFI 草稿已生成，等待 Human Input。')
      db.exec('COMMIT')
    } catch (error) { db.exec('ROLLBACK'); throw error }
    return rfi
  }

  function approveRfi(projectId: string, rfiId: string) {
    const rfi = get('SELECT * FROM rfis WHERE id = ? AND project_id = ?', rfiId, projectId)
    if (!rfi || rfi.status !== 'draft') throw new Error('RFI draft not found')
    db.exec('BEGIN')
    try {
      run('UPDATE rfis SET status = ? WHERE id = ?', 'open', rfiId)
      run('UPDATE human_inputs SET status = ?, decision = ?, resolved_at = ? WHERE rfi_id = ? AND status = ?', 'resolved', 'approve', now(), rfiId, 'pending')
      run('UPDATE items SET status = ? WHERE id = ?', 'awaiting_rfi', String(rfi.item_id))
      run('UPDATE tasks SET status = ?, checkpoint = ?, updated_at = ? WHERE item_id = ?', 'waiting_human', 'RFI 草稿已在本地确认，等待人工发送和记录回复；系统不会自动发送。', now(), String(rfi.item_id))
      addEvent(projectId, String(rfi.item_id), 'rfi_approved', 'RFI 草稿已在本地确认，待人工处理。')
      db.exec('COMMIT')
    } catch (error) { db.exec('ROLLBACK'); throw error }
    return get('SELECT * FROM rfis WHERE id = ?', rfiId)
  }

  function resolveHumanInput(projectId: string, inputId: string, decision: 'approve' | 'defer') {
    const input = get('SELECT * FROM human_inputs WHERE id = ? AND project_id = ? AND status = ?', inputId, projectId, 'pending')
    if (!input) throw new Error('Pending Human Input not found')
    if (decision === 'approve') return approveRfi(projectId, String(input.rfi_id))
    if (decision !== 'defer') throw new Error('Invalid decision')
    db.exec('BEGIN')
    try {
      run('UPDATE human_inputs SET status = ?, decision = ?, resolved_at = ? WHERE id = ?', 'resolved', 'defer', now(), inputId)
      run('UPDATE tasks SET status = ?, checkpoint = ?, updated_at = ? WHERE item_id = ?', 'active', '你暂缓了 RFI 草稿；需补充资料或重新确认。', now(), String(input.item_id))
      addEvent(projectId, String(input.item_id), 'human_input_deferred', '用户暂缓 RFI 草稿。')
      db.exec('COMMIT')
    } catch (error) { db.exec('ROLLBACK'); throw error }
    return get('SELECT * FROM human_inputs WHERE id = ?', inputId)
  }

  function answerRfi(projectId: string, rfiId: string, answer: string) {
    const rfi = get('SELECT * FROM rfis WHERE id = ? AND project_id = ?', rfiId, projectId)
    if (!rfi || rfi.status !== 'open') throw new Error('Open RFI not found')
    db.exec('BEGIN')
    try {
      run('UPDATE rfis SET answer = ?, status = ?, answered_at = ? WHERE id = ?', answer, 'answered', now(), rfiId)
      run('UPDATE tasks SET status = ?, checkpoint = ?, updated_at = ? WHERE item_id = ?', 'active', '收到 RFI 回复；需要重新检索并复核验收项。', now(), String(rfi.item_id))
      run('UPDATE items SET status = ? WHERE id = ?', 'needs_evidence', String(rfi.item_id))
      addEvent(projectId, String(rfi.item_id), 'rfi_answered', '收到 RFI 回复，待重新核验。')
      db.exec('COMMIT')
    } catch (error) { db.exec('ROLLBACK'); throw error }
    return get('SELECT * FROM rfis WHERE id = ?', rfiId)
  }

  function acceptItem(projectId: string, itemId: string) {
    const item = get('SELECT * FROM items WHERE id = ? AND project_id = ?', itemId, projectId)
    if (!item) throw new Error('Acceptance item not found')
    if (item.status !== 'ready_for_review') throw new Error('Item is not ready for human review')
    const evidenceCount = get('SELECT COUNT(*) AS count FROM evidence WHERE item_id = ?', itemId)
    const answeredRfi = get('SELECT id FROM rfis WHERE item_id = ? AND status = ?', itemId, 'answered')
    if (Number(evidenceCount?.count) === 0 && !answeredRfi) throw new Error('No source or RFI answer to review')
    db.exec('BEGIN')
    try {
      run('UPDATE items SET status = ? WHERE id = ?', 'accepted', itemId)
      run('UPDATE tasks SET status = ?, checkpoint = ?, updated_at = ? WHERE item_id = ?', 'completed', '人工复核完成，验收项已确认。', now(), itemId)
      addEvent(projectId, itemId, 'human_accepted', '验收项由人工确认通过。')
      db.exec('COMMIT')
    } catch (error) { db.exec('ROLLBACK'); throw error }
    return itemDetail(projectId, itemId)
  }

  function itemDetail(projectId: string, itemId: string) {
    const item = get('SELECT * FROM items WHERE id = ? AND project_id = ?', itemId, projectId)
    if (!item) throw new Error('Acceptance item not found')
    return {
      ...(item as unknown as ItemRow),
      task: get('SELECT * FROM tasks WHERE item_id = ?', itemId) ?? null,
      evidence: all(`SELECT e.id, e.score, c.body, c.position, d.title AS document_title, d.id AS document_id
        FROM evidence e JOIN chunks c ON c.id = e.chunk_id JOIN documents d ON d.id = c.document_id WHERE e.item_id = ? ORDER BY e.score DESC`, itemId),
      rfis: all('SELECT * FROM rfis WHERE item_id = ? ORDER BY created_at DESC', itemId),
    }
  }

  function projectState(projectId: string) {
    const project = get('SELECT * FROM projects WHERE id = ?', projectId)
    if (!project) throw new Error('Project not found')
    return {
      project,
      items: all('SELECT * FROM items WHERE project_id = ? ORDER BY created_at', projectId),
      documents: all('SELECT id, title, source_type, created_at FROM documents WHERE project_id = ? ORDER BY created_at DESC', projectId),
      tasks: all('SELECT * FROM tasks WHERE project_id = ? ORDER BY updated_at DESC', projectId),
      rfis: all('SELECT * FROM rfis WHERE project_id = ? ORDER BY created_at DESC', projectId),
      human_inputs: all('SELECT * FROM human_inputs WHERE project_id = ? ORDER BY created_at DESC', projectId),
      facts: all('SELECT * FROM facts WHERE project_id = ? ORDER BY created_at DESC', projectId),
      conversations: all('SELECT * FROM conversations WHERE project_id = ? ORDER BY created_at DESC', projectId),
      events: all('SELECT * FROM events WHERE project_id = ? ORDER BY created_at DESC LIMIT 30', projectId),
    }
  }

  function createConversation(projectId: string, title = '新会话') {
    if (!projectExists(projectId)) throw new Error('Project not found')
    const conversation = { id: id(), project_id: projectId, title, created_at: now() }
    run('INSERT INTO conversations VALUES (?, ?, ?, ?)', conversation.id, projectId, title, conversation.created_at)
    return conversation
  }

  function addFact(projectId: string, body: string) {
    if (!projectExists(projectId)) throw new Error('Project not found')
    const fact = { id: id(), project_id: projectId, body, source_type: 'user_confirmed', created_at: now() }
    run('INSERT INTO facts VALUES (?, ?, ?, ?, ?)', fact.id, projectId, body, fact.source_type, fact.created_at)
    addEvent(projectId, null, 'fact_added', '新增一条经用户确认的项目约定。')
    return fact
  }

  function addMessage(conversationId: string, role: 'user' | 'assistant', body: string) {
    const conversation = get('SELECT * FROM conversations WHERE id = ?', conversationId)
    if (!conversation) throw new Error('Conversation not found')
    const message = { id: id(), conversation_id: conversationId, role, body, created_at: now() }
    run('INSERT INTO messages VALUES (?, ?, ?, ?, ?)', message.id, conversationId, role, body, message.created_at)
    return message
  }

  function conversationState(conversationId: string) {
    const conversation = get('SELECT * FROM conversations WHERE id = ?', conversationId)
    if (!conversation) throw new Error('Conversation not found')
    return { conversation, messages: all('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at, rowid', conversationId) }
  }

  function continuity(projectId: string) {
    const state = projectState(projectId)
    const active = state.tasks.filter(t => t.status !== 'completed')
    const lines = active.map(t => {
      const item = state.items.find(i => i.id === t.item_id)
      return `• ${item?.title ?? '验收项'}：${t.checkpoint}`
    })
    return active.length ? `这个项目有 ${active.length} 项待继续：\n${lines.join('\n')}` : '当前没有待续任务。可以选择验收项开始核验。'
  }

  function exportManifest(projectId: string) {
    if (!projectExists(projectId)) throw new Error('Project not found')
    const items = all('SELECT id, status FROM items WHERE project_id = ? ORDER BY id', projectId).map(item => {
      const sources = all(`SELECT c.id, c.body FROM evidence e JOIN chunks c ON c.id = e.chunk_id WHERE e.item_id = ? ORDER BY c.id`, String(item.id))
      const replies = all('SELECT id, answer FROM rfis WHERE item_id = ? AND status = ? ORDER BY id', String(item.id), 'answered')
      return { item_id: item.id, status: item.status, sources: sources.map(source => ({ source_id: source.id, content_hash: sha256(String(source.body)) })), rfi_replies: replies.map(reply => ({ rfi_id: reply.id, answer_hash: sha256(String(reply.answer)) })) }
    })
    const payload = { schema: 'project-plus.continuity.v1', project_id: projectId, items }
    return { payload, project_key: sha256(projectId), root: sha256(JSON.stringify(payload)), algorithm: 'SHA-256', chain_status: 'not_anchored' }
  }

  function seedDemo() {
    const existing = get('SELECT id FROM projects LIMIT 1')
    if (existing) return String(existing.id)
    const project = createProject('示例 · 连锁门店交付验收', '演示数据，非真实客户项目。')
    addItem(project.id, '空调系统调试', '提交空调系统调试报告，记录各区域温度、风量、测试日期和责任人。')
    addItem(project.id, '消防系统联动测试', '提供消防联动测试记录、问题整改闭环和签字确认。')
    addItem(project.id, '竣工图版本核对', '核对最终竣工图版本、变更记录与现场一致性。')
    addDocument(project.id, '示例资料 · 空调调试记录', '空调系统调试报告，2026-10-06。测试区域：一层营业区。温度 24°C，风量 1200 m³/h。测试人：李工。\n\n二层营业区风量尚未记录，待现场补测。', 'sample')
    return project.id
  }

  return { db, all, get, run, createProject, addItem, addDocument, retrieve, analyzeItem, draftRfi, approveRfi, resolveHumanInput, answerRfi, acceptItem, itemDetail, projectState, createConversation, addFact, addMessage, conversationState, continuity, exportManifest, seedDemo }
}
