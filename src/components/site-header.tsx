import type { ReactNode } from 'react'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { BotIcon } from 'lucide-react'
export function SiteHeader({ title, onAgent, actions }: { title: string; onAgent?: () => void; actions?: ReactNode }) {
  return <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)"><div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6"><SidebarTrigger className="-ml-1" /><Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" /><h1 className="min-w-0 truncate text-base font-medium">{title}</h1>{actions && <div className="ml-auto">{actions}</div>}{onAgent && <Button className="ml-auto" variant="outline" size="sm" onClick={onAgent}><BotIcon data-icon="inline-start" />项目 Agent</Button>}</div></header>
}
