import { useEffect, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from 'ai'
import { Streamdown } from 'streamdown'
import { ArrowUpIcon, SquareIcon, PaperclipIcon, MoreHorizontalIcon, BotIcon, CheckIcon, LoaderCircleIcon, CircleHelpIcon, CircleAlertIcon, RotateCcwIcon, ArrowDownIcon } from 'lucide-react'
import { Brand } from '@/components/brand'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import type { View } from '@/components/app-sidebar'
import { cn } from 'cn'
import { continuity, resolveInput, uid, type Project, type Conversation, type Template, type HumanInput } from '@/lib/local-store'
import { answerHuman, executeAgentTool, projectContext, toolLabels, type ToolName } from '@/lib/agent-tools'
import { recoverMessages, requestHistory } from '@/lib/chat-history'

type Props = { project: Project; templates: Template[]; conversation: Conversation; mode: string; mutate: (fn: (p: Project) => void) => Promise<void>; onAddDocument: () => void; onView: (view: View) => void }
export function AgentPanel({ project, templates, conversation, mode, mutate, onAddDocument, onView }: Props) {
  const [input, setInput] = useState('')
  const [localError, setLocalError] = useState('')
  const [interrupted, setInterrupted] = useState(conversation.execution === 'running' || conversation.execution === 'interrupted')
  const [localBusy, setLocalBusy] = useState(false)
  const [limited, setLimited] = useState(false)
  const [away, setAway] = useState(false)
  const latest = useRef(project)
  useEffect(() => { latest.current = project }, [project])
  const scroll = useRef<HTMLDivElement>(null)
  const follow = useRef(true)
  const stopped = useRef(false)
  const sending = useRef(false)
  const calls = useRef(0)
  // Callback reads the ref only when the SDK sends a request.
  // oxlint-disable-next-line react/refs
  const [transport] = useState(() => new DefaultChatTransport({ api: '/api/chat', prepareSendMessagesRequest: ({ messages, id }) => ({ body: { id, ...requestHistory(messages), context: projectContext(latest.current) } }) }))
  const chat = useChat({
    id: conversation.id,
    messages: recoverMessages(conversation.uiMessages ?? [], project.agent_calls, conversation.id),
    transport,
    experimental_throttle: 50,
    sendAutomaticallyWhen: ({ messages }) => !stopped.current && calls.current < 16 && !latest.current.human_inputs.some(h => h.status === 'pending') && lastAssistantMessageIsCompleteWithToolCalls({ messages }),
    async onToolCall({ toolCall }) {
      if (toolCall.dynamic) return
      try {
        if (++calls.current >= 16) setLimited(true)
        if (stopped.current || calls.current > 16) throw new Error('本轮已暂停。可以检查进展后继续。')
        let output: unknown
        await mutate(p => { output = executeAgentTool(p, templates, conversation.id, toolCall.toolCallId, toolCall.toolName, toolCall.input); latest.current = p })
        void chat.addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output })
      } catch (error) {
        void chat.addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, state: 'output-error', errorText: error instanceof Error ? error.message : '工具未完成' })
      }
    },
  })
  const pending = project.human_inputs.filter(h => h.status === 'pending')
  const busy = localBusy || chat.status === 'streaming' || chat.status === 'submitted'
  const execution = busy ? 'running' : pending.length ? 'paused' : chat.error ? 'error' : interrupted ? 'interrupted' : 'idle'
  const serialized = JSON.stringify(chat.messages)
  const persistence = useRef<{ serialized: string; execution: Conversation['execution'] }>({ serialized, execution })
  const saved = useRef('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const save = useRef<() => void>(() => {})
  useEffect(() => {
    persistence.current = { serialized, execution }
    save.current = () => {
      const snapshot = persistence.current
      const key = `${snapshot.execution}:${snapshot.serialized}`
      if (saved.current === key) return
      saved.current = key
      void mutate(p => {
        const c = p.conversations.find(c => c.id === conversation.id)
        if (c) { c.uiMessages = JSON.parse(snapshot.serialized) as UIMessage[]; c.execution = snapshot.execution }
      }).catch(err => { saved.current = ''; setLocalError(String(err)) })
    }
    if (!busy) { if (timer.current) clearTimeout(timer.current); timer.current = null; save.current() }
    else if (!timer.current) timer.current = setTimeout(() => { timer.current = null; save.current() }, 250)
  }, [serialized, execution, busy, conversation.id, mutate])
  const { stop } = chat
  useEffect(() => () => { stopped.current = true; void stop(); if (timer.current) clearTimeout(timer.current); save.current() }, [stop])
  useEffect(() => {
    if (follow.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight
  }, [serialized, pending.length, localError])
  async function send(text: string) {
    if (!text.trim() || sending.current || busy || latest.current.human_inputs.some(h => h.status === 'pending')) return
    sending.current = true; stopped.current = false; calls.current = 0; follow.current = true
    setInput(''); setLocalError(''); setInterrupted(false); setLimited(false)
    try {
      await mutate(p => { const c = p.conversations.find(c => c.id === conversation.id); if (c && !c.uiMessages?.length) c.title = text.trim().slice(0, 24) })
      if (mode === 'model') await chat.sendMessage({ text })
      else {
        setLocalBusy(true)
        const reply = `${continuity(latest.current)}\n\n当前未连接模型。配置模型后，我可以根据你的目标查找清单、建立任务、检索证据，并在需要信息时向你提问。`
        chat.setMessages([...chat.messages, { id: uid(), role: 'user', parts: [{ type: 'text', text }] }, { id: uid(), role: 'assistant', parts: [{ type: 'text', text: reply }] }])
      }
    } catch (error) { setLocalError(error instanceof Error ? error.message : '请求未完成。') }
    finally { sending.current = false; setLocalBusy(false) }
  }
  async function respond(h: HumanInput, answer: string) {
    setLocalError(''); setLocalBusy(true)
    try {
      await mutate(p => { if (h.kind === 'question') answerHuman(p, h.id, answer); else resolveInput(p, h.id, answer as 'approve' | 'defer'); latest.current = p })
      setLocalBusy(false)
      // Use an explicit user turn after the durable decision; tools cannot approve themselves.
      const text = h.kind === 'question' ? `关于“${h.question}”，我的补充是：${answer}。请继续。` : answer === 'approve' ? '我已确认 RFI 草稿。请读回最新进展并继续；对外发送仍由我处理。' : '这份 RFI 暂缓。请保留当前进度，不要重新起草，等我补充资料。'
      await send(text)
    } catch (error) { setLocalError(String(error)); setLocalBusy(false) }
  }
  function stopGeneration() { stopped.current = true; setInterrupted(true); void chat.stop() }
  return <section className="flex min-h-0 flex-1 flex-col" aria-label="项目 Agent 工作区">
    <div className="mx-auto flex w-full max-w-3xl shrink-0 items-center gap-3 px-4 py-3 lg:px-6">
      <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{conversation.title === '新对话' ? '新任务' : conversation.title}</p>
      <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="任务资料与结果" />}><MoreHorizontalIcon /></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuGroup><DropdownMenuItem onClick={() => onView('tasks')}>查看验收结果</DropdownMenuItem><DropdownMenuItem onClick={() => onView('rfis')}>查看 RFI</DropdownMenuItem><DropdownMenuItem onClick={() => onView('library')}>选择验收标准</DropdownMenuItem><DropdownMenuItem onClick={() => onView('documents')}>项目资料与约定</DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent></DropdownMenu>
      {mode !== 'model' && <Badge variant="outline">未连接模型</Badge>}
    </div>
    <div ref={scroll} className={cn("min-h-0 overflow-y-auto overscroll-contain", chat.messages.length || pending.length ? "flex-1" : "mt-auto")} role="log" tabIndex={0} aria-live="polite" aria-relevant="additions" aria-label="对话记录" onScroll={e => { const el = e.currentTarget; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; setAway(!follow.current) }}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-6 lg:px-6">
        {!chat.messages.length && !pending.length && <Empty className="gap-7 py-10 md:py-16">
          <EmptyHeader className="max-w-lg gap-4"><EmptyMedia><Brand compact /></EmptyMedia><EmptyTitle><h2 className="text-2xl font-semibold tracking-tight md:text-3xl">把下一步，交给项目家。</h2></EmptyTitle><EmptyDescription>从一个目标开始。查找依据、推进任务，<br className="hidden sm:block" />需要你决定时，我会停下来等你。</EmptyDescription></EmptyHeader>
          <EmptyContent className="max-w-lg"><div className="flex flex-wrap justify-center gap-2">{['规划一次验收', '检查缺失的证据', '继续上次的工作'].map(text => <Button key={text} variant="outline" size="sm" onClick={() => setInput(text)}>{text}</Button>)}</div></EmptyContent>
        </Empty>}
        {chat.messages.map((m, index) => <article key={m.id} className={cn('flex min-w-0 flex-col gap-3', m.role === 'user' && 'items-end')} aria-label={m.role === 'user' ? '你的消息' : 'Agent 回复'}>
          {m.role === 'assistant' && <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><BotIcon className="size-4" />项目 Agent</span>}
          {m.parts.map((part, i) => part.type === 'text' ? m.role === 'user' ? <div key={i} className="max-w-[90%] whitespace-pre-wrap break-words rounded-xl bg-muted px-4 py-3 text-sm leading-7">{part.text}</div> : <Streamdown controls={false} key={i} className="min-w-0 text-sm leading-7 [&_table]:text-xs" isAnimating={chat.status === 'streaming' && index === chat.messages.length - 1}>{part.text}</Streamdown> : part.type.startsWith('tool-') && 'state' in part ? <ToolProgress key={i} part={part} /> : null)}
        </article>)}
        {pending.map(h => <HumanInputCard key={h.id} input={h} project={project} busy={busy} onRespond={answer => void respond(h, answer)} />)}
        {busy && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" />{chat.status === 'streaming' ? '正在处理…' : '正在思考下一步…'}</p>}
        {(chat.error || localError) && <Alert variant="destructive"><CircleAlertIcon /><AlertDescription>{localError || '这次回复中断了，已保存的任务和内容仍在。'}<Button variant="outline" size="sm" className="mt-2 self-start" disabled={busy || !!pending.length} onClick={() => void send('刚才的回复中断了。请先读取项目当前状态，再继续未完成的工作。')}><RotateCcwIcon />重试并继续</Button></AlertDescription></Alert>}
        {(interrupted || limited) && !busy && !pending.length && <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"><span className="text-muted-foreground">{limited ? '本轮已达到执行步数上限，进展已保存。' : '生成已暂停，已有进展保留。'}</span><Button variant="outline" size="sm" onClick={() => void send('请读取当前项目状态，继续刚才未完成的工作。')}>继续任务</Button></div>}
      </div>
    </div>
    <div className={cn("mx-auto w-full max-w-3xl shrink-0 px-4 pb-4 pt-2 lg:px-6", !chat.messages.length && !pending.length && "mb-auto")}>
      {away && <div className="mb-2 flex justify-center"><Button variant="outline" size="sm" onClick={() => { follow.current = true; setAway(false); if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight }}><ArrowDownIcon />回到最新</Button></div>}
      <form className="rounded-2xl border border-border bg-card p-4 shadow-sm focus-within:ring-2 focus-within:ring-ring/20" onSubmit={e => { e.preventDefault(); void send(input) }}>
        <Textarea aria-label="向 Agent 提问" value={input} onChange={e => setInput(e.target.value)} placeholder={pending.length ? '请先回应上方的待确认事项…' : '交代一个任务，或补充项目背景…'} rows={2} className="max-h-40 min-h-16 resize-none border-0 px-1 shadow-none focus-visible:ring-0 [field-sizing:content]" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(input) } }} />
        <div className="flex items-center justify-between gap-3"><Button type="button" variant="ghost" size="sm" onClick={onAddDocument}><PaperclipIcon data-icon="inline-start" />添加资料</Button>{busy ? <Button type="button" size="icon" aria-label="停止生成" onClick={stopGeneration}><SquareIcon /></Button> : <Button type="submit" size="icon" aria-label="发送消息" disabled={!input.trim() || !!pending.length}><ArrowUpIcon /></Button>}</div>
      </form><p className="mt-2 text-center text-xs text-muted-foreground">{mode === 'model' ? '重要决定由你确认。项目进展保存在当前浏览器。' : '当前为流程预览，配置模型后可开始实际执行。'}</p>
    </div>
  </section>
}
function HumanInputCard({ input, project, busy, onRespond }: { input: HumanInput; project: Project; busy: boolean; onRespond: (value: string) => void }) {
  const [answer, setAnswer] = useState('')
  const question = input.kind === 'question'
  return <Card className="shrink-0 border-primary/30 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><CircleHelpIcon className="size-4 text-primary" />{question ? '需要你补充一点信息' : '请确认这份 RFI 草稿'}</CardTitle><CardDescription>等待你的决定 · 确认后继续执行</CardDescription></CardHeader><CardContent className="flex flex-col gap-3"><p className="whitespace-pre-wrap text-sm leading-7">{question ? input.question : project.rfis.find(r => r.id === input.rfi_id)?.question}</p>{question && <>{!!input.options?.length && <div className="flex flex-wrap gap-2">{input.options.map(option => <Button key={option} variant={answer === option ? 'secondary' : 'outline'} size="sm" disabled={busy} onClick={() => setAnswer(option)}>{option}</Button>)}</div>}<Textarea aria-label="补充信息" value={answer} onChange={e => setAnswer(e.target.value)} placeholder="选择一个选项，也可以直接补充…" className="max-h-40 [field-sizing:fixed]" /></>}{!question && <p className="text-xs text-muted-foreground">确认会保存草稿状态，对外发送仍由你完成。</p>}</CardContent><CardFooter className="gap-2">{question ? <Button size="sm" disabled={busy || !answer.trim()} onClick={() => onRespond(answer)}>确认并继续</Button> : <><Button size="sm" disabled={busy} onClick={() => onRespond('approve')}>确认草稿并继续</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => onRespond('defer')}>暂缓</Button></>}</CardFooter></Card>
}
function ToolProgress({ part }: { part: UIMessage['parts'][number] }) {
  if (!('state' in part)) return null
  const failed = part.state === 'output-error' || part.state === 'output-denied'
  const done = part.state === 'output-available'
  const label = toolLabels[part.type.replace('tool-', '') as ToolName] ?? '处理任务'
  return <div className="flex flex-col gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground"><span className="flex items-center gap-2">{failed ? <CircleAlertIcon className="size-3.5" /> : done ? <CheckIcon className="size-3.5" /> : <LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" />}{label} · {failed ? '未完成' : done && 'output' in part && part.output && typeof part.output === 'object' && 'waiting_human' in part.output && part.output.waiting_human ? '已暂停，等待你' : done ? '已完成' : '进行中'}</span>{failed && 'errorText' in part && <span>{String(part.errorText)}</span>}{done && part.type === 'tool-search_documents' && 'output' in part && Array.isArray(part.output) && part.output.map((e: { document_title: string; position: number; body: string }, i: number) => <details key={i}><summary className="cursor-pointer py-1">{e.document_title} · 第 {e.position + 1} 段</summary><p className="whitespace-pre-wrap py-2 leading-6">{e.body}</p></details>)}</div>
}
