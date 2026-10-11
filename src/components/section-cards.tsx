import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ListChecksIcon, ListTodoIcon, MessageSquareIcon, UserCheckIcon } from 'lucide-react'
import type { Project } from '@/lib/local-store'
export function SectionCards({ project }: { project: Project }) {
  const cards = [
    { title: '验收清单', value: project.checklists.length, label: '项目清单', description: '从清单库应用的检查标准', icon: ListChecksIcon },
    { title: '验收任务', value: project.items.length, label: '任务总数', description: `${project.items.filter(i => i.status === 'accepted').length} 项已由人工确认通过`, icon: ListTodoIcon },
    { title: 'RFI 澄清', value: project.rfis.filter(r => r.status !== 'answered').length, label: '待处理', description: `${project.rfis.filter(r => r.status === 'answered').length} 条已记录回复`, icon: MessageSquareIcon },
    { title: '等待你确认', value: project.human_inputs.filter(i => i.status === 'pending').length, label: 'Human Input', description: '关键决定由你确认后继续', icon: UserCheckIcon },
  ]
  return <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">{cards.map(c => <Card key={c.title} className="@container/card"><CardHeader><CardDescription>{c.title}</CardDescription><CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{c.value}</CardTitle><CardAction><Badge variant="outline"><c.icon />{c.label}</Badge></CardAction></CardHeader><CardFooter className="flex-col items-start gap-1.5 text-sm"><div className="line-clamp-1 flex gap-2 font-medium">{c.description}</div></CardFooter></Card>)}</div>
}
