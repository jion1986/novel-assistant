'use client'

import { useState, useEffect } from 'react'
import { toast } from '@/components/toast'

interface ChapterVersion {
  id: string
  versionType: string
  content: string
  note: string | null
  createdAt: string
}

interface ChapterVersionHistoryProps {
  bookId: string
  chapterId: string
  onRestore?: (content: string) => void
}

function versionTypeLabel(type: string): string {
  const map: Record<string, string> = {
    ai_draft: 'AI草稿',
    user_edit: '编辑',
    final: '定稿',
  }
  return map[type] || type
}

function versionTypeClass(type: string): string {
  const map: Record<string, string> = {
    ai_draft: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    user_edit: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    final: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  }
  return map[type] || 'bg-muted text-muted-foreground'
}

export function ChapterVersionHistory({ bookId, chapterId, onRestore }: ChapterVersionHistoryProps) {
  const [versions, setVersions] = useState<ChapterVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => {
    async function loadVersions() {
      try {
        const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}/versions`)
        const data = await res.json()
        if (data.success) {
          setVersions(data.data)
        }
      } catch (e) {
        console.error('Failed to load versions:', e)
      } finally {
        setLoading(false)
      }
    }
    loadVersions()
  }, [bookId, chapterId])

  async function restoreVersion(version: ChapterVersion) {
    if (!confirm(`确定回退到 ${versionTypeLabel(version.versionType)} 版本？\n时间: ${new Date(version.createdAt).toLocaleString()}\n\n当前编辑内容将被覆盖。`)) {
      return
    }

    setRestoringId(version.id)
    try {
      const res = await fetch(
        `/api/books/${bookId}/chapters/${chapterId}/versions/${version.id}/restore`,
        { method: 'POST' }
      )
      const data = await res.json()
      if (data.success) {
        onRestore?.(version.content)
        // 刷新版本列表
        const listRes = await fetch(`/api/books/${bookId}/chapters/${chapterId}/versions`)
        const listData = await listRes.json()
        if (listData.success) {
          setVersions(listData.data)
        }
        setExpandedId(null)
      } else {
        toast(`回退失败: ${data.error}`, 'error')
      }
    } catch (e) {
      toast(`请求失败: ${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      setRestoringId(null)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-medium mb-2">版本历史</h3>
        <p className="text-xs text-muted-foreground">加载中...</p>
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-medium mb-2">版本历史</h3>
        <p className="text-xs text-muted-foreground">暂无版本记录</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-medium mb-3">版本历史</h3>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {versions.map((version) => (
          <div
            key={version.id}
            className="rounded-md border p-2.5 text-sm space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${versionTypeClass(version.versionType)}`}>
                  {versionTypeLabel(version.versionType)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(version.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setExpandedId(expandedId === version.id ? null : version.id)}
                  className="text-xs px-2 py-1 rounded hover:bg-accent text-muted-foreground"
                >
                  {expandedId === version.id ? '收起' : '预览'}
                </button>
                <button
                  onClick={() => restoreVersion(version)}
                  disabled={restoringId === version.id}
                  className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {restoringId === version.id ? '回退中...' : '回退'}
                </button>
              </div>
            </div>

            {version.note && (
              <p className="text-xs text-muted-foreground truncate">{version.note}</p>
            )}

            {expandedId === version.id && (
              <div className="mt-2 p-2 rounded bg-muted text-xs max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                {version.content.slice(0, 500)}
                {version.content.length > 500 && (
                  <span className="text-muted-foreground"> ...（共 {version.content.length} 字）</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
