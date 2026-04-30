'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface User {
  userId: string
  username: string
}

export function Header() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUser(data.data)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/login')
  }

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg hover:text-primary transition-colors">
          AI 小说助手
        </Link>

        <nav className="flex items-center gap-4">
          {loading ? (
            <span className="text-sm text-muted-foreground">加载中...</span>
          ) : user ? (
            <>
              <span className="text-sm text-muted-foreground">{user.username}</span>
              <Link
                href="/prompts"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Prompt 管理
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                登出
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              登录
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
