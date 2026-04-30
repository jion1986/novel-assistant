'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit() {
    if (!username.trim() || !password.trim()) return
    setLoading(true)
    setMessage('')

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()
      if (data.success) {
        window.location.href = '/'
      } else {
        setMessage(data.error || '操作失败')
      }
    } catch (e) {
      setMessage(`请求失败: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container mx-auto px-4 py-12 max-w-sm"
    >
      <h1 className="text-2xl font-bold text-center mb-8">AI 小说助手</h1>

      <div className="rounded-lg border bg-card p-6 space-y-4"
      >
        <div className="flex rounded-md border overflow-hidden"
        >
          <button
            onClick={() => { setMode('login'); setMessage('') }}
            className={`flex-1 py-2 text-sm ${mode === 'login' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
          >
            登录
          </button>
          <button
            onClick={() => { setMode('register'); setMessage('') }}
            className={`flex-1 py-2 text-sm ${mode === 'register' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
          >
            注册
          </button>
        </div>

        <div className="space-y-3"
        >
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用户名"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
          />
        </div>

        {message && (
          <p className="text-xs text-red-500">{message}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
        </button>
      </div>

      <div className="mt-4 text-center"
      >
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground"
        >← 返回首页</Link>
      </div>
    </main>
  )
}
