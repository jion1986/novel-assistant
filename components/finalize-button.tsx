'use client'

import { useState } from 'react'
import { toast } from '@/components/toast'

interface FinalizeButtonProps {
  bookId: string
  chapterId: string
  content: string
}

export function FinalizeButton({ bookId, chapterId, content }: FinalizeButtonProps) {
  const [saving, setSaving] = useState(false)

  async function finalize() {
    if (!confirm('确定保存为定稿？定稿后将触发记忆提取。')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}/save-final`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (data.success) {
        toast('定稿已保存！', 'success')
        window.location.reload()
      } else {
        toast(`保存失败: ${data.error}`, 'error')
      }
    } catch (e) {
      toast(`请求失败: ${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      onClick={finalize}
      disabled={saving}
      className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {saving ? '保存中...' : '保存定稿'}
    </button>
  )
}
