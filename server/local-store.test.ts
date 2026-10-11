import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register, login, logout, currentUser, loadWorkspace, updateWorkspace, newProject, importTemplates, loadTemplates, applyTemplate, analyze, draftRfi, resolveInput, answerRfi, acceptItem, continuity } from '../src/lib/local-store.ts'
const session = new Map<string, string>()
Object.defineProperty(globalThis, 'sessionStorage', { value: { getItem: (k: string) => session.get(k) ?? null, setItem: (k: string, v: string) => session.set(k, v), removeItem: (k: string) => session.delete(k) } })
test('local accounts persist and isolate workspaces; failed writes are atomic', async () => {
  const a = await register('甲', 'a@test.local', 'test-password-a')
  await assert.rejects(register('甲', 'A@test.local', 'test-password-a'))
  logout(); assert.equal(await currentUser(), null)
  await assert.rejects(login(a.email, 'wrong-password'))
  assert.equal((await login('A@test.local', 'test-password-a')).id, a.id)
  const b = await register('乙', 'b@test.local', 'test-password-b')
  await updateWorkspace(a.id, w => { w.projects.push(newProject('甲的项目')) })
  await Promise.all([1, 2].map(i => updateWorkspace(a.id, w => { w.projects.push(newProject(`并发保存 ${i}`)) })))
  await assert.rejects(updateWorkspace(a.id, w => { w.projects.length = 0; throw new Error('rollback') }))
  assert.equal((await loadWorkspace(a.id)).projects.length, 3)
  assert.equal((await loadWorkspace(b.id)).projects.length, 0)
})
test('template import preserves standards, rejects invalid input atomically, and applies once', async () => {
  const initial = await loadTemplates(); assert.equal(initial.length, 11); assert.equal(initial.reduce((n, t) => n + t.tasks.length, 0), 221)
  const template = { id: 'source-test', name: '原始清单', description: '原始描述', tasks: [{ name: '电视信号', description: '检查电视各频道清晰度', order: 1 }] }
  await importTemplates([template]); await importTemplates([template])
  await assert.rejects(importTemplates([{ ...template, tasks: [{ name: '坏条目' }] }]))
  const all = await loadTemplates(); assert.equal(all.length, 12); const saved = all.filter(t => t.id === template.id); assert.equal(saved[0].tasks[0].description, template.tasks[0].description)
  const p = newProject('测试'); const id = applyTemplate(p, saved[0]); assert.equal(applyTemplate(p, saved[0]), id); assert.equal(p.items.length, 1)
})
test('human pause survives storage reload and a new conversation; acceptance requires explicit action', async () => {
  const p = newProject('流程测试'); applyTemplate(p, (await loadTemplates()).find(t => t.id === 'source-test')!); const item = p.items[0]
  analyze(p, item.id); assert.equal(item.status, 'needs_evidence'); assert.throws(() => acceptItem(p, item.id))
  draftRfi(p, item.id); draftRfi(p, item.id); assert.equal(p.rfis.length, 1); assert.equal(p.human_inputs.length, 1)
  await updateWorkspace('flow-test', w => { w.projects.push(p) })
  const restored = (await loadWorkspace('flow-test')).projects[0]
  restored.conversations.push({ id: 'new-chat', title: '接续', messages: [] })
  assert.match(continuity(restored), /等待你确认/)
  analyze(restored, item.id); assert.equal(restored.rfis[0].status, 'draft')
  resolveInput(restored, restored.human_inputs[0].id, 'defer'); assert.equal(restored.rfis[0].status, 'draft')
  draftRfi(restored, item.id); resolveInput(restored, restored.human_inputs[0].id, 'approve')
  assert.equal(restored.rfis[0].status, 'open'); assert.equal(restored.items[0].status, 'awaiting_rfi')
  answerRfi(restored, restored.rfis[0].id, '测试回复，交由人工复核'); analyze(restored, item.id)
  assert.equal(restored.items[0].status, 'ready_for_review'); acceptItem(restored, item.id)
  assert.equal(restored.items[0].status, 'accepted'); assert.throws(() => draftRfi(restored, item.id))
})
test('new pending RFI blocks acceptance even after evidence was ready', async () => {
  const p = newProject('不能绕过确认'); applyTemplate(p, (await loadTemplates()).find(t => t.id === 'source-test')!); const item = p.items[0]
  p.documents.push({ id: 'doc', title: '电视检查记录', body: '检查电视各频道清晰度：检查电视各频道清晰度符合要求。', created_at: new Date().toISOString() })
  analyze(p, item.id); assert.equal(item.status, 'ready_for_review')
  draftRfi(p, item.id); assert.throws(() => acceptItem(p, item.id))
})
