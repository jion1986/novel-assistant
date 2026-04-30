'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from '@/components/toast'

interface BookDeleteButtonProps {
  bookId: string
  bookTitle: string
}

export function BookDeleteButton({ bookId, bookTitle }: BookDeleteButtonProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`确定删除小说「${bookTitle}」？此操作不可恢复。`)) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/books/${bookId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast('小说已删除', 'success')
        router.push('/')
      } else {
        toast(`删除失败: ${data.error}`, 'error')
      }
    } catch {
      toast('删除请求失败', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="w-full rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
    >
      {deleting ? '删除中...' : '删除项目'}
    </button>
  )
}
