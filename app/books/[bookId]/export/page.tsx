'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from '@/components/toast'

export default function ExportPage() {
  const params = useParams()
  const bookId = params.bookId as string
  const [exporting, setExporting] = useState(false)

  async function doExport(format: string) {
    setExporting(true)
    try {
      const res = await fetch(`/api/books/${bookId}/export?format=${format}`)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `小说导出.${format === 'markdown' ? 'md' : 'txt'}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      toast('导出失败', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Link href={`/books/${bookId}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回工作台
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6">导出小说</h1>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          导出只包含已定稿的章节。AI 草稿和未写章节不会导出。
        </p>

        <div className="flex gap-4">
          <button
            onClick={() => doExport('markdown')}
            disabled={exporting}
            className="flex-1 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {exporting ? '导出中...' : '导出 Markdown'}
          </button>
          <button
            onClick={() => doExport('txt')}
            disabled={exporting}
            className="flex-1 rounded-md border px-4 py-3 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {exporting ? '导出中...' : '导出 TXT'}
          </button>
        </div>
      </div>
    </main>
  )
}
