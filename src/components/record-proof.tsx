import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Field, FieldLabel, FieldDescription, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { MONAD, manifestFor, digest, verifyProof, anchorWithWallet, type Proof } from '@/lib/monad'
import type { Project } from '@/lib/local-store'
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function RecordProof({ project, open, onOpenChange }: { project: Project; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ proof: Proof; block: number; latest: boolean; source: string } | null>(null)
  const manifest = manifestFor(project)
  const hash = digest(manifest)
  async function inspect(proof: Proof, source: string) { const checked = await verifyProof(proof); setResult({ proof, ...checked, source }) }
  async function run(action: () => Promise<void>) { setBusy(true); setError(''); setResult(null); try { await action() } catch (e) { setError(e instanceof Error ? e.message : '验证失败，请稍后重试。') } finally { setBusy(false) } }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>验证项目记录</DialogTitle><DialogDescription>把验收依据与人工决定的摘要保存在 Monad 测试网。原始资料不上链。</DialogDescription></DialogHeader>
    <FieldGroup><Field><FieldLabel>当前项目摘要</FieldLabel><p className="break-all font-mono text-xs text-muted-foreground">{hash.root}</p><FieldDescription>资料或决定改变后，摘要也会改变。导出文件包含项目资料，请自行保管。</FieldDescription></Field>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => download(manifest, 'project-plus-record.json')}>导出当前记录</Button><Button disabled={busy} onClick={() => void run(async () => { const proof = await anchorWithWallet(manifest); download(proof, 'project-plus-proof.json'); await inspect(proof, '当前项目') })}>{busy ? '处理中…' : '通过钱包保存摘要'}</Button></div>
      <Separator />
      <Field><FieldLabel htmlFor="proof-file">验证已有记录</FieldLabel><Input id="proof-file" type="file" accept=".json,application/json" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) void run(async () => { if (f.size > 5_000_000) throw Error('文件不能超过 5 MB。'); await inspect(JSON.parse(await f.text()) as Proof, '导入记录') }); e.target.value = '' }} /><FieldDescription>本地读取证明文件，与链上交易对照。不会上传原文。</FieldDescription></Field>
      <Button variant="outline" disabled={busy} onClick={() => void run(async () => { const r = await fetch('/monad-demo-proof.json'); if (!r.ok) throw Error('演示证明加载失败'); await inspect(await r.json(), '公开合成演示（非当前项目）') })}>验证公开演示记录</Button>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {result && <Alert><AlertDescription><p>{result.source}</p><p>验证通过 · 区块 {result.block}</p><p>{result.latest ? '与该地址最新提交一致。' : '这是已上链的历史记录，该地址后来提交了新摘要。'}</p><a className="underline" href={`${MONAD.explorer}/tx/${result.proof.transactionHash}`} target="_blank" rel="noreferrer">查看真实交易</a><Button size="sm" variant="outline" onClick={() => download(result.proof, 'project-plus-proof.json')}>下载已验证记录</Button></AlertDescription></Alert>}
      <FieldDescription>摘要一致不代表验收结论真实。最终验收仍需负责人确认。<br /><a className="underline" href={`${MONAD.explorer}/address/${MONAD.contract}`} target="_blank" rel="noreferrer">查看测试网合约</a></FieldDescription>
    </FieldGroup>
  </DialogContent></Dialog>
}
