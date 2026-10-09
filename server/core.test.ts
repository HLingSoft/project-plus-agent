import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStore, verifyManifest } from './core.ts'

test('RFI waits for human input and survives restart across conversations', () => {
  const dir = mkdtempSync(join(tmpdir(), 'project-plus-'))
  const file = join(dir, 'state.sqlite')
  try {
    const store = createStore(file)
    const project = store.createProject('Test project')
    const item = store.addItem(project.id, '消防联动', '提供消防联动测试记录和签字确认')
    const first = store.createConversation(project.id, 'first')
    store.addMessage(first.id, 'user', '请检查消防联动')
    assert.equal(store.analyzeItem(project.id, item.id).status, 'needs_evidence')
    const draft = store.draftRfi(project.id, item.id)
    assert.equal(store.draftRfi(project.id, item.id).id, draft.id)
    const pending = store.projectState(project.id).human_inputs.find(x => x.status === 'pending')
    assert.ok(pending)
    assert.equal(store.analyzeItem(project.id, item.id).task?.status, 'waiting_human')
    store.resolveHumanInput(project.id, String(pending.id), 'approve')
    assert.equal(store.projectState(project.id).human_inputs[0].decision, 'approve')
    assert.equal(store.itemDetail(project.id, item.id).task?.status, 'waiting_human')
    assert.equal(store.analyzeItem(project.id, item.id).task?.status, 'waiting_human')
    assert.equal(store.draftRfi(project.id, item.id).id, draft.id)
    store.db.close()

    const resumed = createStore(file)
    const second = resumed.createConversation(project.id, 'second')
    assert.equal(resumed.conversationState(second.id).messages.length, 0)
    assert.match(resumed.continuity(project.id), /RFI 草稿已在本地确认/)
    resumed.answerRfi(project.id, String(draft.id), '测试记录已补充，由张工签字。')
    assert.match(resumed.continuity(project.id), /重新检索/)
    const result = resumed.analyzeItem(project.id, item.id)
    assert.equal(result.status, 'ready_for_review')
    assert.throws(() => resumed.acceptItem('another-project', item.id), /not found/)
    resumed.acceptItem(project.id, item.id)
    assert.equal(resumed.itemDetail(project.id, item.id).task?.status, 'completed')
    resumed.db.close()
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('Human Input can be deferred without sending or reopening an RFI', () => {
  const store = createStore(':memory:')
  const project = store.createProject('Human input test')
  const item = store.addItem(project.id, '图纸核对', '核对最终竣工图')
  const rfi = store.draftRfi(project.id, item.id)
  const pending = store.projectState(project.id).human_inputs[0]
  store.resolveHumanInput(project.id, String(pending.id), 'defer')
  assert.equal(store.projectState(project.id).human_inputs[0].decision, 'defer')
  assert.equal(store.projectState(project.id).rfis[0].status, 'draft')
  assert.equal(store.itemDetail(project.id, item.id).task?.status, 'active')
  assert.equal(store.draftRfi(project.id, item.id).id, rfi.id)
  store.db.close()
})

test('source retrieval is project-scoped and only produces candidate evidence', () => {
  const store = createStore(':memory:')
  const a = store.createProject('A')
  const b = store.createProject('B')
  const item = store.addItem(a.id, '空调调试', '提供空调调试报告')
  store.addDocument(b.id, 'Private B', '空调调试报告已完成并签署')
  assert.equal(store.retrieve(a.id, '空调调试报告').length, 0)
  store.addDocument(a.id, 'A evidence', '空调调试报告由李工签署。')
  const result = store.analyzeItem(a.id, item.id)
  assert.ok(result.evidence.length > 0)
  assert.equal(result.status, 'ready_for_review')
  assert.equal(result.task?.status, 'ready_for_review')
  store.db.close()
})

test('explicit gaps in retrieved material keep the item open for RFI', () => {
  const store = createStore(':memory:')
  const project = store.createProject('Gap test')
  const item = store.addItem(project.id, '空调调试', '提供空调调试报告及风量记录')
  store.addDocument(project.id, 'Partial report', '空调调试报告已有，但二层风量未记录，待补测。')
  const result = store.analyzeItem(project.id, item.id)
  assert.equal(result.status, 'needs_evidence')
  assert.match(String(result.task?.checkpoint), /建议发起 RFI/)
  store.db.close()
})

test('continuity manifest can be verified and detects changed state', () => {
  const store = createStore(':memory:')
  const project = store.createProject('Manifest test')
  const item = store.addItem(project.id, 'Check', 'Provide report')
  const first = store.exportManifest(project.id)
  assert.equal(verifyManifest(first), true)
  store.addDocument(project.id, 'Report', 'Check report is signed')
  store.analyzeItem(project.id, item.id)
  const second = store.exportManifest(project.id)
  assert.notEqual(first.root, second.root)
  assert.equal(verifyManifest({ ...second, root: first.root }), false)
  store.db.close()
})

test('explicit project fact persists without leaking to another project', () => {
  const store = createStore(':memory:')
  const a = store.createProject('A')
  const b = store.createProject('B')
  store.addFact(a.id, '验收报告必须由项目经理签字')
  store.createConversation(a.id, 'Later conversation')
  assert.match(String(store.projectState(a.id).facts[0].body), /项目经理签字/)
  assert.equal(store.projectState(b.id).facts.length, 0)
  store.db.close()
})

test('unrelated project document is not cited for a different acceptance item', () => {
  const store = createStore(':memory:')
  const project = store.createProject('Retrieval test')
  const item = store.addItem(project.id, '消防系统联动测试', '提供消防联动测试记录和签字确认')
  store.addDocument(project.id, '空调调试记录', '空调系统调试报告已完成。\n\n二层营业区风量尚未记录，待补测。')
  const result = store.analyzeItem(project.id, item.id)
  assert.equal(result.evidence.length, 0)
  assert.equal(result.status, 'needs_evidence')
  store.db.close()
})
