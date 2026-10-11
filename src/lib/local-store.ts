import type { UIMessage } from 'ai'
import { templateSnapshot } from './template-snapshot.js'
export type Status = 'not_started' | 'needs_evidence' | 'awaiting_rfi' | 'ready_for_review' | 'accepted'
export type Template = { id: string; name: string; description: string; tasks: { name: string; description: string; order: number }[]; importedAt: string }
export type Item = { id: string; checklist_id: string | null; title: string; criteria: string; status: Status; created_at: string }
export type Checklist = { id: string; template_id: string; title: string; description: string; created_at: string }
export type Task = { id: string; item_id: string; status: string; checkpoint: string; updated_at: string }
export type Rfi = { id: string; item_id: string; question: string; answer: string | null; status: 'draft' | 'open' | 'answered'; created_at: string }
export type HumanInput = { kind?: 'rfi' | 'question'; options?: string[]; conversation_id?: string; id: string; item_id: string; rfi_id: string; question: string; status: 'pending' | 'resolved'; decision: string | null }
export type Evidence = { id: string; item_id: string; document_id: string; document_title: string; position: number; body: string; score: number }
export type ProjectDocument = { id: string; title: string; body: string; created_at: string }
export type Message = { id: string; role: 'user' | 'assistant'; body: string }
export type Conversation = { id: string; title: string; messages: Message[]; uiMessages?: UIMessage[]; execution?: 'running' | 'idle' | 'paused' | 'interrupted' | 'error' }
export type Project = { agent_calls?: Record<string, { tool: string; output: unknown }>; id: string; name: string; items: Item[]; checklists: Checklist[]; tasks: Task[]; rfis: Rfi[]; human_inputs: HumanInput[]; evidence: Evidence[]; documents: ProjectDocument[]; facts: { id: string; body: string }[]; conversations: Conversation[]; events: { id: string; detail: string; created_at: string }[] }
export type Workspace = { projects: Project[] }
export type User = { id: string; email: string; name: string }
type Account = User & { salt: string; hash: string }
export const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()
let dbPromise: Promise<IDBDatabase> | undefined
function openDatabase() {
  return dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('project-plus-browser-v1', 1)
    req.onupgradeneeded = () => { req.result.createObjectStore('accounts', { keyPath: 'email' }); req.result.createObjectStore('workspaces'); req.result.createObjectStore('catalog') }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(new Error('无法打开浏览器数据库，请检查存储权限。'))
  })
}
async function read<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => { const req = db.transaction(store, 'readonly').objectStore(store).get(key); req.onsuccess = () => resolve(req.result as T | undefined); req.onerror = () => reject(req.error) })
}
async function write(store: string, value: unknown, key?: string, add = false) {
  const db = await openDatabase()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    if (add) tx.objectStore(store).add(value); else tx.objectStore(store).put(value, key)
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(new Error('保存失败，账号可能已存在，或存储空间不足。'))
  })
}
const toHex = (bytes: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('')
async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 210000 }, key, 256))
}
export async function register(name: string, email: string, password: string): Promise<User> {
  email = email.trim().toLowerCase()
  if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) throw new Error('请填写姓名、有效邮箱和至少 8 位密码。')
  if (await read('accounts', email)) throw new Error('这个邮箱已在当前浏览器注册，请登录。')
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)))
  const account: Account = { id: uid(), name: name.trim(), email, salt, hash: await passwordHash(password, salt) }
  await write('accounts', account, undefined, true)
  const user = { id: account.id, name: account.name, email }; sessionStorage.setItem('project-plus-user', JSON.stringify(user)); return user
}
export async function login(email: string, password: string): Promise<User> {
  const account = await read<Account>('accounts', email.trim().toLowerCase())
  if (!account || await passwordHash(password, account.salt) !== account.hash) throw new Error('邮箱或密码不正确。请使用当前浏览器注册的账号。')
  const user = { id: account.id, name: account.name, email: account.email }; sessionStorage.setItem('project-plus-user', JSON.stringify(user)); return user
}
export async function currentUser(): Promise<User | null> {
  try {
    const user = JSON.parse(sessionStorage.getItem('project-plus-user') || 'null') as User | null
    if (!user) return null
    const account = await read<Account>('accounts', user.email)
    return account?.id === user.id ? { id: account.id, email: account.email, name: account.name } : null
  } catch { return null }
}
export function logout() { sessionStorage.removeItem('project-plus-user') }
export async function loadWorkspace(userId: string): Promise<Workspace> { return await read<Workspace>('workspaces', userId) ?? { projects: [] } }
export async function updateWorkspace(userId: string, update: (data: Workspace) => void): Promise<Workspace> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('workspaces', 'readwrite'); const store = tx.objectStore('workspaces'); const req = store.get(userId)
    let workspace: Workspace; let failure: unknown
    req.onsuccess = () => { try { workspace = req.result ?? { projects: [] }; update(workspace); store.put(workspace, userId) } catch (error) { failure = error; tx.abort() } }
    tx.oncomplete = () => resolve(workspace); tx.onabort = () => reject(failure ?? new Error('保存失败，请检查浏览器存储空间。'))
  })
}
export async function loadTemplates(): Promise<Template[]> { return await read<Template[]>('catalog', 'templates') ?? await importTemplates(templateSnapshot) }
export async function importTemplates(input: unknown) {
  if (!Array.isArray(input) || !input.length || input.length > 100) throw new Error('需要 1–100 套清单模板。')
  const templates: Template[] = input.map(t => {
    if (!t || typeof t.id !== 'string' || !t.id || typeof t.name !== 'string' || !t.name.trim() || typeof t.description !== 'string' || !Array.isArray(t.tasks) || !t.tasks.length || t.tasks.length > 500) throw new Error('模板格式不完整。')
    return { id: t.id, name: t.name, description: t.description, importedAt: now(), tasks: t.tasks.map((e: {name: string; description: string; order: number}, i: number) => {
      if (!e || typeof e.name !== 'string' || !e.name.trim() || typeof e.description !== 'string' || !e.description.trim()) throw new Error('条目需要名称和检查标准。')
      return { name: e.name, description: e.description, order: Number.isFinite(e.order) ? e.order : i + 1 }
    }) }
  })
  const previous = await read<Template[]>('catalog', 'templates') ?? []; const merged = new Map(previous.map(t => [t.id, t])); templates.forEach(t => merged.set(t.id, t))
  await write('catalog', Array.from(merged.values()), 'templates'); return Array.from(merged.values())
}
export function newProject(name: string): Project {
  if (!name.trim()) throw new Error('请填写项目名称。')
  return { id: uid(), name: name.trim(), items: [], checklists: [], tasks: [], rfis: [], human_inputs: [], evidence: [], documents: [], facts: [], conversations: [{ id: uid(), title: '新对话', messages: [] }], events: [] }
}
export function event(project: Project, detail: string) { project.events.unshift({ id: uid(), detail, created_at: now() }) }
export function addItem(project: Project, title: string, criteria: string, checklistId: string | null = null) {
  if (!title.trim() || !criteria.trim()) throw new Error('请填写条目名称与验收标准。')
  const item: Item = { id: uid(), checklist_id: checklistId, title: title.trim(), criteria: criteria.trim(), status: 'not_started', created_at: now() }
  project.items.push(item); event(project, `添加验收任务：${title}`); return item
}
export function applyTemplate(project: Project, template: Template) {
  const previous = project.checklists.find(c => c.template_id === template.id); if (previous) return previous.id
  const checklist: Checklist = { id: uid(), template_id: template.id, title: template.name, description: template.description, created_at: now() }
  project.checklists.push(checklist)
  template.tasks.toSorted((a, b) => a.order - b.order).forEach(t => addItem(project, t.name, t.description, checklist.id))
  event(project, `从清单库添加：${template.name}`); return checklist.id
}
function tokens(input: string) {
  const value = input.toLowerCase()
  return new Set([...(value.match(/[a-z0-9]{2,}/g) ?? []), ...(value.match(/[\p{Script=Han}]+/gu) ?? []).flatMap(word => Array.from({ length: Math.max(0, word.length - 1) }, (_, i) => word.slice(i, i + 2)))])
}
const gapPattern = /未记录|未提供|未完成|待补|缺少|待确认|尚未/
export function retrieve(project: Project, query: string): Evidence[] {
  const queryTokens = tokens(query)
  return project.documents.flatMap(doc => {
    const chunks = doc.body.split(/\n\s*\n/).filter(Boolean).flatMap(p => p.match(/[\s\S]{1,700}/g) ?? [])
    const results = chunks.map((body, position) => {
      const matches = tokens(body); const score = Array.from(queryTokens).filter(t => matches.has(t)).length / Math.max(1, queryTokens.size)
      return { id: `${doc.id}:${position}`, item_id: '', document_id: doc.id, document_title: doc.title, position, body, score }
    })
    if (!results.some(r => r.score >= .25)) return []
    return results.filter(r => r.score >= .15 || gapPattern.test(r.body))
  }).sort((a, b) => b.score - a.score).slice(0, 5)
}
function itemOf(project: Project, itemId: string) { const item = project.items.find(i => i.id === itemId); if (!item) throw new Error('验收任务不存在。'); return item }
function checkpoint(project: Project, itemId: string, status: string, text: string) {
  const task = project.tasks.find(t => t.item_id === itemId)
  if (task) Object.assign(task, { status, checkpoint: text, updated_at: now() }); else project.tasks.push({ id: uid(), item_id: itemId, status, checkpoint: text, updated_at: now() })
  event(project, text)
}
export function analyze(project: Project, itemId: string) {
  const item = itemOf(project, itemId); if (item.status === 'accepted') throw new Error('这项任务已由人工验收。')
  if (project.rfis.some(r => r.item_id === itemId && r.status === 'open') || project.human_inputs.some(h => h.item_id === itemId && h.status === 'pending')) return
  const found = retrieve(project, `${item.title} ${item.criteria}`).map(e => ({ ...e, item_id: itemId })); project.evidence = project.evidence.filter(e => e.item_id !== itemId).concat(found)
  const replied = project.rfis.some(r => r.item_id === itemId && r.status === 'answered')
  item.status = replied || (found.some(e => e.score >= .25) && !found.some(e => gapPattern.test(e.body))) ? 'ready_for_review' : 'needs_evidence'
  checkpoint(project, itemId, item.status === 'ready_for_review' ? 'ready_for_review' : 'active', item.status === 'ready_for_review' ? '已整理候选证据或 RFI 回复，等待人工核对验收标准。' : '验收资料存在缺口，需要补充证据或发起 RFI。')
}
export function draftRfi(project: Project, itemId: string) {
  const item = itemOf(project, itemId); if (item.status === 'accepted') throw new Error('已验收任务不能起草 RFI。')
  let rfi = project.rfis.find(r => r.item_id === itemId && r.status !== 'answered'); if (rfi?.status === 'open') return rfi
  if (!rfi) { rfi = { id: uid(), item_id: itemId, question: `关于“${item.title}”，请提供以下检查要求的资料或说明：${item.criteria.replace(/[。.!！?？]+$/, '')}。请注明资料版本、日期和责任人。`, answer: null, status: 'draft', created_at: now() }; project.rfis.unshift(rfi) }
  if (!project.human_inputs.some(h => h.rfi_id === rfi.id && h.status === 'pending')) project.human_inputs.unshift({ id: uid(), item_id: itemId, rfi_id: rfi.id, question: '请确认 RFI 草稿', status: 'pending', decision: null })
  item.status = 'needs_evidence'
  checkpoint(project, itemId, 'waiting_human', '已生成 RFI 草稿，等待你确认或暂缓。'); return rfi
}
export function resolveInput(project: Project, inputId: string, decision: 'approve' | 'defer') {
  const input = project.human_inputs.find(h => h.id === inputId && h.status === 'pending'); if (!input) throw new Error('这个待确认事项已处理。')
  if (decision !== 'approve' && decision !== 'defer') throw new Error('无效操作。')
  const rfi = project.rfis.find(r => r.id === input.rfi_id)!; input.status = 'resolved'; input.decision = decision
  if (decision === 'approve') { rfi.status = 'open'; itemOf(project, input.item_id).status = 'awaiting_rfi' }
  checkpoint(project, input.item_id, decision === 'approve' ? 'waiting_human' : 'active', decision === 'approve' ? 'RFI 草稿已确认，等待人工发送和记录回复。' : 'RFI 已暂缓，可以补充资料或重新发起确认。')
}
export function answerRfi(project: Project, rfiId: string, answer: string) {
  const rfi = project.rfis.find(r => r.id === rfiId && r.status === 'open'); if (!rfi || !answer.trim()) throw new Error('请为等待回复的 RFI 填写回复。')
  rfi.answer = answer.trim(); rfi.status = 'answered'; itemOf(project, rfi.item_id).status = 'needs_evidence'; checkpoint(project, rfi.item_id, 'active', '收到 RFI 回复，等待重新核验。')
}
export function acceptItem(project: Project, itemId: string) {
  const item = itemOf(project, itemId)
  if (project.human_inputs.some(h => h.status === 'pending' && (h.item_id === itemId || h.kind === 'question')) || project.rfis.some(r => r.item_id === itemId && r.status === 'open')) throw new Error('请先处理待确认事项和 RFI。')
  if (item.status !== 'ready_for_review' || (!project.evidence.some(e => e.item_id === itemId) && !project.rfis.some(r => r.item_id === itemId && r.status === 'answered'))) throw new Error('请先核验证据，再确认验收。')
  item.status = 'accepted'; checkpoint(project, itemId, 'completed', '人工复核完成，验收通过。')
}
export function continuity(project: Project) {
  const tasks = project.tasks.filter(t => t.status !== 'completed')
  return tasks.length ? `还有 ${tasks.length} 项工作需要继续：\n${tasks.map(t => `• ${itemOf(project, t.item_id).title}：${t.checkpoint}`).join('\n')}` : `当前项目有 ${project.checklists.length} 套清单、${project.items.length} 项验收任务。可以选择一项任务开始核验。`
}
