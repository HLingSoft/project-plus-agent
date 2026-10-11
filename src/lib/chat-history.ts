import type { UIMessage } from 'ai'
import type { Project } from './local-store.ts'

export function recoverMessages(messages: UIMessage[], calls: Project['agent_calls'], conversationId: string): UIMessage[] {
  return messages.map(message => ({ ...message, parts: message.parts.map(part => {
    if (part.type === 'text') return { ...part, state: 'done' as const }
    if (part.type.startsWith('tool-') && 'toolCallId' in part && 'state' in part) {
      if (part.state === 'output-available' || part.state === 'output-error' || part.state === 'output-denied') return part
      const output = calls?.[`${conversationId}:${part.toolCallId}`]
      if (output) return { ...part, state: 'output-available' as const, output: output.output }
      // Do not replay an unfinished mutation automatically after a refresh.
      return { ...part, state: 'output-error' as const, errorText: '上次执行被中断，请读取当前项目状态后决定下一步。', input: 'input' in part ? part.input ?? {} : {} }
    }
    return part
  }) as UIMessage['parts'] }))
}
export function requestHistory(messages: UIMessage[]) {
  const recent = messages.slice(-40)
  // Keep the browser transcript intact. The model gets a bounded recent window;
  // search_history lets it retrieve older passages instead of silently losing them.
  const earlier = messages.slice(0, -40).flatMap(m => m.parts.filter(p => p.type === 'text').map(p => `${m.role}: ${p.type === 'text' ? p.text : ''}`)).join('\n').slice(-8000)
  return { messages: recent, earlier_context: earlier }
}
