import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createStore } from './core.ts'
import { runAgentTurn } from './agent.ts'

test('model tool loop reads project state and returns a grounded answer', async () => {
  const store = createStore(':memory:')
  const project = store.createProject('Tool test')
  store.addItem(project.id, '消防联动', '提供联动测试记录')
  const conversation = store.createConversation(project.id)
  store.addMessage(conversation.id, 'user', '有哪些验收项？')
  let calls = 0
  const request = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls += 1
    const body = JSON.parse(String(init?.body))
    if (calls === 1) return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'list_items', arguments: '{}' } }] } }] }), { status: 200 })
    assert.equal(body.messages.at(-1).role, 'tool')
    assert.match(body.messages.at(-1).content, /消防联动/)
    return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: '目前有消防联动验收项。' } }] }), { status: 200 })
  }) as typeof fetch
  const reply = await runAgentTurn(store, project.id, conversation.id, { endpoint: 'http://mock', key: 'test', model: 'test-model', request })
  assert.equal(reply, '目前有消防联动验收项。')
  assert.equal(calls, 2)
  store.db.close()
})

test('model can draft RFI but cannot bypass Human Input', async () => {
  const store = createStore(':memory:')
  const project = store.createProject('Approval test')
  const item = store.addItem(project.id, '竣工图', '提供竣工图版本')
  const conversation = store.createConversation(project.id)
  store.addMessage(conversation.id, 'user', '为竣工图起草 RFI')
  let calls = 0
  const request = (async () => {
    calls += 1
    return new Response(JSON.stringify({ choices: [{ message: calls === 1
      ? { role: 'assistant', content: null, tool_calls: [{ id: 'call_rfi', type: 'function', function: { name: 'draft_rfi', arguments: JSON.stringify({ item_id: item.id }) } }] }
      : { role: 'assistant', content: 'RFI 草稿已准备，请在 Human Input 卡片确认。' } }] }), { status: 200 })
  }) as typeof fetch
  await runAgentTurn(store, project.id, conversation.id, { endpoint: 'http://mock', key: 'test', model: 'test-model', request })
  assert.equal(store.projectState(project.id).rfis[0].status, 'draft')
  assert.equal(store.projectState(project.id).human_inputs[0].status, 'pending')
  store.db.close()
})
