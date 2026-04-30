'use client'

import { useState } from 'react'
import {
  estimateWriteChapterCost,
  formatCost,
  formatTokens,
} from '@/lib/ai/costEstimator'

interface ChapterActionsProps {
  bookId: string
  chapterId: string
  status: string
}

export function ChapterActions({ bookId, chapterId, status }: ChapterActionsProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<string>('')

  async function callAction(type: string) {
    setLoading(type)
    setMessage('')
    try {
      const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}/${type}`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setMessage('操作成功！')
        if (type === 'write') setTimeout(() => window.location.reload(), 800)
      } else {
        setMessage(`失败: ${data.error}`)
      }
    } catch (e) {
      setMessage(`请求失败: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(null)
    }
  }

  // 预估写章节成本（基于典型上下文长度 3000 tokens）
  const writeCost = estimateWriteChapterCost(3000)

  return (
    <div className="space-y-3">
      <div>
        <button
          onClick={() => callAction('write')}
          disabled={!!loading}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading === 'write' ? '生成中...' : '生成正文'}
        </button>
        <p className="text-xs text-muted-foreground mt-1">
          预计 {formatTokens(writeCost.totalTokens)} tokens / {formatCost(writeCost.cost)}
        </p>
      </div>

      <button
        onClick={() => callAction('check')}
        disabled={!!loading}
        className="w-full rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
      >
        {loading === 'check' ? '检查中...' : '一致性检查'}
      </button>

      {status === 'finalized' && (
        <button
          onClick={() => callAction('extract-memory')}
          disabled={!!loading}
          className="w-full rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
        >
          {loading === 'extract-memory' ? '提取中...' : '提取记忆'}
        </button>
      )}

      {message && (
        <p className={`text-xs ${message.includes('失败') ? 'text-red-500' : 'text-green-600'}`}>{message}</p>
      )}
    </div>
  )
}
