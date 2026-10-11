import { z } from 'zod'
import { analyze, applyTemplate, continuity, draftRfi, event, retrieve, uid, type Project, type Template } from './local-store.js'

export const toolDefinitions = {
  get_project_state: { description: '读取任务进展、待确认事项、RFI 与项目约定；接续工作时先调用。', inputSchema: z.object({}) },
  list_templates: { description: '按用途查找现有验收清单模板，返回来源 ID 与条目数量。', inputSchema: z.object({ query: z.string().max(200).optional() }) },
  apply_template: { description: '将用户明确选定的模板加入当前项目；有歧义时先询问用户。重复调用不会重复创建。', inputSchema: z.object({ template_id: z.string() }) },
  list_items: { description: '查看验收任务，可按清单或未完成状态筛选。', inputSchema: z.object({ checklist_id: z.string().optional(), unfinished_only: z.boolean().optional() }) },
  search_history: { description: '检索当前项目的完整历史对话。当近期上下文没有较早约定时使用关键词查找，不得猜测。', inputSchema: z.object({ query: z.string().min(1).max(200) }) },
  search_documents: { description: '检索项目资料，返回文件名、原文和段落位置。只是候选证据。', inputSchema: z.object({ query: z.string().min(1).max(1000) }) },
  analyze_item: { description: '整理一项任务的证据和缺口，不能代替人工验收。', inputSchema: z.object({ item_id: z.string() }) },
  draft_rfi: { description: '起草 RFI，持久暂停并等待人工确认，不对外发送。', inputSchema: z.object({ item_id: z.string() }) },
  ask_human: { description: '缺少信息或需要决策时，提出一个简短问题并暂停；可提供最多三个选项，用户也能自由补充。', inputSchema: z.object({ question: z.string().min(1).max(1000), options: z.array(z.string().min(1).max(120)).max(3).optional() }) },
} as const
export type ToolName = keyof typeof toolDefinitions
export const toolLabels: Record<ToolName, string> = { get_project_state: '读取项目进展', list_templates: '查找验收标准', apply_template: '建立验收任务', list_items: '查看验收任务', search_documents: '检索项目证据', search_history: '回查历史对话', analyze_item: '核验候选证据', draft_rfi: '起草 RFI', ask_human: '等待你的补充' }
export function projectContext(p: Project) {
  return { name: p.name, continuity: continuity(p), facts: p.facts, checklists: p.checklists.map(c => ({id:c.id,title:c.title})), counts: { tasks: p.items.length, documents: p.documents.length }, human_inputs: p.human_inputs.slice(0, 20), rfis: p.rfis.slice(0, 20), steps: p.tasks.slice(0, 30) }
}
// Executed inside the same IndexedDB transaction as the resulting project state.
export function executeAgentTool(p: Project, templates: Template[], conversationId: string, callId: string, name: string, input: unknown): unknown {
  const definition = toolDefinitions[name as ToolName]
  if (!Object.hasOwn(toolDefinitions, name) || !definition) throw new Error('不支持这个工具。')
  const args = definition.inputSchema.parse(input) as { query?: string; template_id?: string; item_id?: string; checklist_id?: string; unfinished_only?: boolean; question?: string; options?: string[] }
  const key = `${conversationId}:${callId}`
  p.agent_calls ??= {}
  if (p.agent_calls[key]) return p.agent_calls[key].output
  const mutation = ['apply_template', 'analyze_item', 'draft_rfi', 'ask_human'].includes(name)
  if (mutation && p.human_inputs.some(h => h.status === 'pending')) throw new Error('请先处理待确认的 Human Input，项目尚未改变。')
  let output: unknown
  switch (name) {
    case 'get_project_state': output = projectContext(p); break
    case 'list_templates': output = templates.filter(t => !args.query || `${t.name} ${t.description}`.includes(args.query)).map(t => ({ id: t.id, name: t.name, description: t.description, count: t.tasks.length })); break
    case 'apply_template': {
      const template = templates.find(t => t.id === args.template_id); if (!template) throw new Error('清单模板不存在。')
      const id = applyTemplate(p, template); output = { checklist_id: id, items: p.items.filter(i => i.checklist_id === id) }; break
    }
    case 'list_items': output = p.items.filter(i => (!args.checklist_id || i.checklist_id === args.checklist_id) && (!args.unfinished_only || i.status !== 'accepted')); break
    case 'search_history': {
      const query = args.query!.toLowerCase(); output = p.conversations.flatMap(c => (c.uiMessages ?? []).flatMap(m => m.parts.filter(part => part.type === 'text' && part.text.toLowerCase().includes(query)).map(part => ({ conversation: c.title, message_id: m.id, role: m.role, text: part.type === 'text' ? part.text.slice(Math.max(0, part.text.toLowerCase().indexOf(query) - 200), part.text.toLowerCase().indexOf(query) + 1200) : '' })))).slice(-6); break
    }
    case 'search_documents': output = retrieve(p, args.query!); break
    case 'analyze_item': analyze(p, args.item_id!); output = { item: p.items.find(i => i.id === args.item_id), evidence: p.evidence.filter(e => e.item_id === args.item_id), checkpoint: p.tasks.find(t => t.item_id === args.item_id) }; break
    case 'draft_rfi': output = { rfi: draftRfi(p, args.item_id!), waiting_human: true }; break
    case 'ask_human': {
      const h = { id: uid(), kind: 'question' as const, item_id: '', rfi_id: '', conversation_id: conversationId, question: args.question!, options: args.options ?? [], status: 'pending' as const, decision: null }
      p.human_inputs.unshift(h); event(p, `等待人工补充：${h.question}`); output = { input_id: h.id, waiting_human: true, question: h.question }; break
    }
  }
  p.agent_calls[key] = { tool: name, output }
  return output
}
export function answerHuman(p: Project, inputId: string, response: string) {
  const h = p.human_inputs.find(h => h.id === inputId && h.status === 'pending' && h.kind === 'question')
  if (!h || !response.trim()) throw new Error('请补充信息后继续。')
  h.status = 'resolved'; h.decision = response.trim(); event(p, `已补充：${h.question} — ${h.decision}`)
}
