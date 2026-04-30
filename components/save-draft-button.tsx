'use client'

import { useState } from 'react'

interface SaveDraftButtonProps {
  bookId: string
  chapterId: string
  content: string
}

export function SaveDraftButton({ bookId, chapterId, content }: SaveDraftButtonProps) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function saveDraft() {
    setSaving(true)
    try {
      const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftContent: content, status: 'edited' }),
      })
      const data = await res.json()
      if (data.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      onClick={saveDraft}
      disabled={saving}
      className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
    >
      {saving ? '保存中...' : saved ? '已保存' : '保存草稿'}
    </button>
  )
}
