'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from '@/components/toast'

export default function NewBookPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)

    const form = e.currentTarget
    const formData = new FormData(form)

    const body = {
      title: formData.get('title') as string,
      genre: formData.get('genre') as string,
      coreIdea: formData.get('coreIdea') as string,
      targetWords: Number(formData.get('targetWords')),
      style: formData.get('style') as string,
    }

    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        router.push(`/books/${data.data.id}`)
      } else {
        toast(`创建失败: ${data.error}`, 'error')
      }
    } catch (err) {
      toast(`请求失败: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回项目列表
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6">新建小说</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">小说标题</label>
          <input
            name="title"
            type="text"
            required
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="输入小说标题"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">题材</label>
          <select name="genre" required className="w-full rounded-md border bg-background px-3 py-2 text-sm">
            <option value="">选择题材</option>
            <option value="都市异能">都市异能</option>
            <option value="玄幻升级">玄幻升级</option>
            <option value="悬疑推理">悬疑推理</option>
            <option value="言情">言情</option>
            <option value="科幻">科幻</option>
            <option value="历史">历史</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">核心创意（一句话）</label>
          <textarea
            name="coreIdea"
            required
            className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px]"
            placeholder="例如：一个普通上班族意外获得读取他人情绪的能力，卷入都市阴谋..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">目标字数</label>
          <input
            name="targetWords"
            type="number"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            defaultValue={300000}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">文风偏好</label>
          <input
            name="style"
            type="text"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="例如：快节奏、热血、细腻描写..."
          />
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? '创建中...' : '创建项目'}
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border px-6 py-2 text-sm font-medium hover:bg-accent"
          >
            取消
          </Link>
        </div>
      </form>
    </main>
  )
}
