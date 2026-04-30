'use client'

import { useState } from 'react'
import { toast } from '@/components/toast'

interface BookInfo {
  title: string
  genre: string
  coreIdea: string
  targetWords: number | null
  style: string | null
}

interface BookInfoEditorProps {
  bookId: string
  initial: BookInfo
}

export function BookInfoEditor({ bookId, initial }: BookInfoEditorProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<BookInfo>(initial)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/books/${bookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          coreIdea: data.coreIdea,
          targetWords: data.targetWords,
          style: data.style,
        }),
      })
      const result = await res.json()
      if (result.success) {
        setEditing(false)
        // 刷新页面以显示更新后的数据
        window.location.reload()
      } else {
        toast(`保存失败: ${result.error}`, 'error')
      }
    } catch {
      toast('保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">书名</label>
          <input
            value={data.title}
            onChange={(e) => setData((d) => ({ ...d, title: e.target.value }))}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">核心创意</label>
          <textarea
            value={data.coreIdea}
            onChange={(e) => setData((d) => ({ ...d, coreIdea: e.target.value }))}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">目标字数</label>
            <input
              type="number"
              value={data.targetWords || ''}
              onChange={(e) => setData((d) => ({ ...d, targetWords: e.target.value ? parseInt(e.target.value) : null }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">文风</label>
            <input
              value={data.style || ''}
              onChange={(e) => setData((d) => ({ ...d, style: e.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
          <button
            onClick={() => { setEditing(false); setData(initial) }}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            取消
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{data.title}</h1>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-primary hover:underline"
        >
          编辑信息
        </button>
      </div>
      <p className="text-muted-foreground">{data.coreIdea}</p>
    </div>
  )
}
