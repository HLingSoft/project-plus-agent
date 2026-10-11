import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { login, register, type User } from '@/lib/local-store'

// Official login-03 composition; local email/password flow replaces social providers.
export function LoginForm({ onLogin }: { onLogin: (user: User) => void }) {
  const [signUp, setSignUp] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const values = new FormData(e.currentTarget); setBusy(true); setError('')
    try {
      const email = String(values.get('email')); const password = String(values.get('password'))
      if (signUp && password !== values.get('confirm')) throw new Error('两次输入的密码不一致。')
      onLogin(signUp ? await register(String(values.get('name')), email, password) : await login(email, password))
    } catch (err) { setError(err instanceof Error ? err.message : '登录失败，请重试。') } finally { setBusy(false) }
  }
  return <div className="flex flex-col gap-6"><Card className="shadow-sm"><CardHeader className="text-center"><CardTitle className="text-xl">{signUp ? '创建你的账号' : '欢迎回来'}</CardTitle><CardDescription>{signUp ? '让每一次对话，接着推进项目' : '登录项目家，接着上次的工作继续'}</CardDescription></CardHeader><CardContent><form onSubmit={submit}><FieldGroup>
    {signUp && <Field><FieldLabel htmlFor="name">姓名</FieldLabel><Input id="name" name="name" autoComplete="name" required maxLength={60} placeholder="怎么称呼你" /></Field>}
    <Field><FieldLabel htmlFor="email">邮箱</FieldLabel><Input id="email" name="email" type="email" autoComplete="email" required placeholder="你的邮箱" /></Field>
    <Field><FieldLabel htmlFor="password">密码</FieldLabel><Input id="password" name="password" type="password" autoComplete={signUp ? 'new-password' : 'current-password'} minLength={8} required placeholder="至少 8 位" /></Field>
    {signUp && <Field><FieldLabel htmlFor="confirm">确认密码</FieldLabel><Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required /></Field>}
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <Field><Button type="submit" disabled={busy}>{busy ? '请稍候…' : signUp ? '注册并开始' : '登录'}</Button><FieldDescription className="text-center">{signUp ? '已经有账号？' : '还没有账号？'} <Button type="button" variant="link" className="h-auto p-0" onClick={() => { setSignUp(!signUp); setError('') }}>{signUp ? '去登录' : '注册账号'}</Button></FieldDescription></Field>
  </FieldGroup></form></CardContent></Card><FieldDescription className="px-6 text-center">本地试用版 · 账号与项目保存在当前浏览器<br />清除网站数据会移除本地记录</FieldDescription></div>
}
