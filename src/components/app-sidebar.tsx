import { MessageSquareTextIcon, CirclePlusIcon, ChevronDownIcon, LogOutIcon } from 'lucide-react'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarGroup, SidebarGroupLabel, useSidebar } from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { Brand } from '@/components/brand'
import { Button } from '@/components/ui/button'
import type { User, Project } from '@/lib/local-store'
export type View = 'agent' | 'overview' | 'checklists' | 'tasks' | 'rfis' | 'library' | 'documents'
export function AppSidebar({ activeId, projects, projectId, onProject, onCreate, onNew, onSelect, onAgent, user, onLogout }: { activeId?: string; projects: Project[]; projectId: string; onProject: (id: string) => void; onCreate: () => void; onNew: () => void; onSelect: (id: string) => void; onAgent: () => void; user: User; onLogout: () => void }) {
  const { isMobile, setOpenMobile } = useSidebar()
  const project = projects.find(p => p.id === projectId)
  function go(action: () => void) { action(); if (isMobile) setOpenMobile(false) }
  return <Sidebar collapsible="offcanvas" variant="inset"><SidebarHeader className="px-4 pb-4 pt-5"><SidebarMenu><SidebarMenuItem><SidebarMenuButton className="h-12" onClick={() => go(onAgent)}><Brand /></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarHeader>
    <SidebarContent>
      <SidebarGroup className="px-4"><SidebarMenu><SidebarMenuItem><DropdownMenu><DropdownMenuTrigger render={<SidebarMenuButton />}><span className="truncate">{project?.name ?? '选择项目'}</span><ChevronDownIcon className="ml-auto" /></DropdownMenuTrigger><DropdownMenuContent className="max-w-72"><DropdownMenuGroup><DropdownMenuLabel>项目</DropdownMenuLabel>{projects.map(p => <DropdownMenuItem key={p.id} onClick={() => go(() => onProject(p.id))}>{p.name}</DropdownMenuItem>)}<DropdownMenuItem onClick={() => go(onCreate)}><CirclePlusIcon />新建项目</DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent></DropdownMenu></SidebarMenuItem>
      <SidebarMenuItem><Button onClick={() => go(onNew)} variant="outline" className="mt-2 w-full justify-start"><CirclePlusIcon data-icon="inline-start" />新任务</Button></SidebarMenuItem></SidebarMenu></SidebarGroup>
      <SidebarGroup className="px-4"><SidebarGroupLabel>最近任务</SidebarGroupLabel><SidebarMenu>{project?.conversations.map(c => <SidebarMenuItem key={c.id}><SidebarMenuButton isActive={activeId === c.id} onClick={() => go(() => onSelect(c.id))} tooltip={c.title}><MessageSquareTextIcon /><span>{c.title === '新对话' ? '新任务' : c.title}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu>{!project?.conversations.length && <p className="px-2 text-xs text-muted-foreground">开始后，可以在这里接着做。</p>}</SidebarGroup>
    </SidebarContent>
    <SidebarFooter className="p-4"><SidebarMenu><SidebarMenuItem><DropdownMenu><DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />}><Avatar className="size-8 rounded-lg"><AvatarFallback className="rounded-lg">{user.name.slice(0, 1)}</AvatarFallback></Avatar><div className="grid flex-1 text-left text-sm leading-tight"><span className="truncate font-medium">{user.name}</span><span className="truncate text-xs text-foreground/70">{user.email}</span></div></DropdownMenuTrigger><DropdownMenuContent side="top" align="end" className="min-w-56"><DropdownMenuGroup><DropdownMenuLabel>当前浏览器的本地账号</DropdownMenuLabel><DropdownMenuItem onClick={onLogout}><LogOutIcon />退出登录</DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent></DropdownMenu></SidebarMenuItem></SidebarMenu></SidebarFooter>
  </Sidebar>
}
