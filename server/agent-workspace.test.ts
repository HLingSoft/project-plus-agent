import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { UIMessage } from 'ai'
import { newProject } from '../src/lib/local-store.ts'
import { answerHuman, executeAgentTool } from '../src/lib/agent-tools.ts'
import { recoverMessages, requestHistory } from '../src/lib/chat-history.ts'
const templates = [{ id: 't', name: '弱电', description: '检查', importedAt: '', tasks: [{ name: '电视信号', description: '检查频道清晰度', order: 1 }] }]
test('agent builds real tasks and pauses on ambiguity; answer unblocks next step', () => {
  const p = newProject('测试'); const c = p.conversations[0].id
  assert.deepEqual(executeAgentTool(p, templates, c, '1', 'list_templates', { query: '弱电' }), [{ id: 't', name: '弱电', description: '检查', count: 1 }])
  executeAgentTool(p, templates, c, '2', 'ask_human', { question: '哪一套？', options: ['弱电'] })
  assert.throws(() => executeAgentTool(p, templates, c, '3', 'apply_template', { template_id: 't' }), /Human Input/)
  assert.equal(p.checklists.length, 0)
  answerHuman(p, p.human_inputs[0].id, '弱电')
  const original = executeAgentTool(p, templates, c, '3', 'apply_template', { template_id: 't' })
  assert.deepEqual(executeAgentTool(p, templates, c, '3', 'apply_template', { template_id: 't' }), original)
  assert.equal(p.items.length, 1)
  executeAgentTool(p, templates, c, '4', 'analyze_item', { item_id: p.items[0].id })
  executeAgentTool(p, templates, c, '5', 'draft_rfi', { item_id: p.items[0].id })
  assert.equal(p.rfis.length, 1); assert.equal(p.human_inputs[0].status, 'pending')
  assert.throws(() => executeAgentTool(p, templates, c, '6', 'accept_item', { item_id: p.items[0].id }), /不支持/)
  assert.throws(() => executeAgentTool(p, templates, c, '7', 'send_rfi', {}), /不支持/)
})
test('more than 200 messages retain full local history and send bounded context', () => {
  const p = newProject('长对话'); const c = p.conversations[0]
  c.uiMessages = Array.from({ length: 300 }, (_, i): UIMessage => ({ id: String(i), role: i % 2 ? 'assistant' : 'user', parts: [{ type: 'text', text: i === 0 ? '预算上限是80万元' : `消息${i}` }] }))
  const sent = requestHistory(c.uiMessages)
  assert.equal(sent.messages.length, 40); assert.equal(c.uiMessages.length, 300)
  const found = executeAgentTool(p, [], c.id, 'search', 'search_history', { query: '预算' }) as { text: string }[]
  assert.match(found[0].text, /80万元/)
  const other = newProject('其他项目'); assert.deepEqual(executeAgentTool(other, [], other.conversations[0].id, 'search', 'search_history', { query: '预算' }), [])
})
test('refresh recovers completed tool output and marks unfinished tools interrupted without replay', () => {
  const p = newProject('恢复'); const c = p.conversations[0].id
  const output = executeAgentTool(p, templates, c, 'applied', 'apply_template', { template_id: 't' })
  const messages: UIMessage[] = [{ id: 'a', role: 'assistant', parts: [
    { type: 'tool-apply_template', toolCallId: 'applied', state: 'input-available', input: { template_id: 't' } },
    { type: 'tool-draft_rfi', toolCallId: 'unfinished', state: 'input-streaming', input: {} },
  ] }]
  const recovered = recoverMessages(messages, p.agent_calls, c)
  assert.equal((recovered[0].parts[0] as { output: unknown }).output, output)
  assert.equal((recovered[0].parts[1] as { state: string }).state, 'output-error')
  assert.equal(p.items.length, 1); assert.equal(p.rfis.length, 0)
})
