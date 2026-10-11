import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findTemplates } from '../src/lib/agent-tools.js'
import { templateSnapshot } from '../src/lib/template-snapshot.js'
const templates = templateSnapshot.map(t => ({...t, importedAt: 'test'}))
test('template lookup searches inspection entries and compound Chinese queries', () => {
  for (const query of ['电视', '客房网络', '弱电']) assert.ok(findTemplates(templates, query).some(t => t.name.includes('弱电')), query)
  assert.equal(findTemplates(templates, '   ').length, 11)
  assert.equal(findTemplates(templates, 'unrelated-astronomy').length, 0)
})
test('document tools expose one-based citation paragraphs matching the UI', async () => {
  const { executeAgentTool } = await import('../src/lib/agent-tools.js')
  const { newProject } = await import('../src/lib/local-store.js')
  const p = newProject('citation test')
  p.documents.push({ id: 'doc', title: '网络复测记录', body: '网络稳定性测试完成。', created_at: 'test' })
  const result = executeAgentTool(p, [], 'chat', 'call', 'search_documents', { query: '网络稳定性' }) as {position:number;paragraph:number}[]
  assert.equal(result[0].position, 0); assert.equal(result[0].paragraph, 1)
})
test('inspection retrieval keeps measurements adjacent to a matching requirements paragraph', async () => {
  const { newProject, retrieve } = await import('../src/lib/local-store.js')
  const p = newProject('inspection')
  p.documents.push({id:'followup',title:'复测报告',created_at:'test',body:'检查网络线路是否已通，其稳定性、网速是否符合要求。\n\n演示房间 301 连续连接 30 分钟，未发生中断，丢包率 0%，三次下载速率分别为 91、94、93 Mbps。'})
  const results = retrieve(p,'检查网络线路是否已通，其稳定性、网速是否符合要求')
  assert.ok(results.some(e=>e.position===1 && e.body.includes('丢包率 0%')))
})
