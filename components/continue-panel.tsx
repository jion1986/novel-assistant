'use client'

import { useState } from 'react'
import { toast } from '@/components/toast'

interface ContinuePanelProps {
  bookId: string
  chapterId: string
  onAppend: (content: string) => void
}

export function ContinuePanel({ bookId, chapterId, onAppend }: ContinuePanelProps) {
  const [loading, setLoading] = useState(false)
  const [wordCount, setWordCount] = useState(500)

  async function handleContinue() {
    setLoading(true)
    try {
      const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordCount }),
      })
      const data = await res.json()
      if (data.success) {
        onAppend(data.data.content)
      } else {
        toast(`续写失败: ${data.error}`, 'error')
      }
    } catch (e) {
      toast(`请求失败: ${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-medium mb-3">AI 续写</h3>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">续写字数:</span>
          <select
            value={wordCount}
            onChange={(e) => setWordCount(Number(e.target.value))}
            className="rounded border bg-background px-2 py-1 text-sm"
          >
            <option value={300}>300 字</option>
            <option value={500}>500 字</option>
            <option value={800}>800 字</option>
            <option value={1000}>1000 字</option>
          </select>
        </div>
        <button
          onClick={handleContinue}
          disabled={loading}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? '续写中...' : '从光标处续写'}
        </button>
        <p className="text-xs text-muted-foreground">基于当前内容末尾自动续写</p>
      </div>
    </div>
  )
}
