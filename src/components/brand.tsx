import { cn } from 'cn'

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return <span className={cn('inline-flex shrink-0 items-center gap-3', className)}>
    <img src="/project-plus-logo.png" alt="" width={36} height={36} className="size-9 rounded-xl" />
    {!compact && <span className="flex flex-col items-start gap-0.5"><span className="text-sm font-semibold tracking-tight">项目家</span><span className="text-[11px] tracking-wide text-muted-foreground">Project+ AI</span></span>}
  </span>
}
