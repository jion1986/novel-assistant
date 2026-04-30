'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from '@/components/toast'

interface Chapter {
  id: string
  chapterNumber: number
  title: string
  status: string
  wordCount: number | null
}

interface ChapterListProps {
  bookId: string
  initialChapters: Chapter[]
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    unwritten: '未写',
    ai_draft: 'AI草稿',
    edited: '已编辑',
    finalized: '已定稿',
  }
  return map[status] || status
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    unwritten: 'bg-muted text-muted-foreground',
    ai_draft: 'bg-blue-100 text-blue-700',
    edited: 'bg-yellow-100 text-yellow-700',
    finalized: 'bg-green-100 text-green-700',
  }
  return map[status] || 'bg-muted'
}

function SortableChapterItem({
  chapter,
  bookId,
  onDelete,
  deleting,
  selected,
  onSelect,
  batchMode,
}: {
  chapter: Chapter
  bookId: string
  onDelete: (id: string) => void
  deleting: string | null
  selected: boolean
  onSelect: (id: string) => void
  batchMode: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chapter.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between rounded-md border px-4 py-3 hover:bg-accent transition-colors group bg-card ${selected ? 'ring-2 ring-primary' : ''}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {batchMode ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect(chapter.id)}
            className="rounded border bg-background"
          />
        ) : (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1"
            title="拖拽排序"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <circle cx="2" cy="3" r="1.2" />
              <circle cx="6" cy="3" r="1.2" />
              <circle cx="10" cy="3" r="1.2" />
              <circle cx="2" cy="9" r="1.2" />
              <circle cx="6" cy="9" r="1.2" />
              <circle cx="10" cy="9" r="1.2" />
            </svg>
          </button>
        )}
        <Link
          href={`/books/${bookId}/chapters/${chapter.id}`}
          className="flex items-center gap-3 flex-1 min-w-0"
        >
          <span className="text-sm font-mono text-muted-foreground w-12 shrink-0">
            第{chapter.chapterNumber}章
          </span>
          <span className="text-sm font-medium truncate">{chapter.title}</span>
        </Link>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {chapter.wordCount ? (
          <span className="text-xs text-muted-foreground">{chapter.wordCount}字</span>
        ) : null}
        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(chapter.status)}`}>
          {statusLabel(chapter.status)}
        </span>
        {!batchMode && (
          <button
            onClick={() => onDelete(chapter.id)}
            disabled={deleting === chapter.id}
            className="opacity-0 group-hover:opacity-100 text-xs text-red-500 hover:text-red-700 transition-opacity px-2 py-0.5 rounded hover:bg-red-50"
            title="删除章节"
          >
            {deleting === chapter.id ? '删除中' : '删除'}
          </button>
        )}
      </div>
    </div>
  )
}

export function ChapterList({ bookId, initialChapters }: ChapterListProps) {
  const [chapters, setChapters] = useState(initialChapters)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [insertAfter, setInsertAfter] = useState<number | null>(null)
  const [reordering, setReordering] = useState(false)
  const [batchMode, setBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchFinalizing, setBatchFinalizing] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function selectAll() {
    const editable = chapters.filter((c) => c.status === 'edited' || c.status === 'ai_draft').map((c) => c.id)
    setSelectedIds(new Set(editable))
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function batchFinalize() {
    if (selectedIds.size === 0) return
    if (!confirm(`确定将选中的 ${selectedIds.size} 章保存为定稿？`)) return

    setBatchFinalizing(true)
    let successCount = 0
    let failCount = 0

    for (const chapterId of selectedIds) {
      try {
        const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}/save-final`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '' }),
        })
        const data = await res.json()
        if (data.success) {
          successCount++
        } else {
          failCount++
        }
      } catch {
        failCount++
      }
    }

    setBatchFinalizing(false)
    setBatchMode(false)
    setSelectedIds(new Set())

    if (failCount === 0) {
      toast(`${successCount} 章已定稿`, 'success')
    } else {
      toast(`${successCount} 章成功，${failCount} 章失败`, 'error')
    }

    // 刷新列表
    const listRes = await fetch(`/api/books/${bookId}/chapters`)
    const listData = await listRes.json()
    if (listData.success) {
      setChapters(listData.data.map((c: any) => ({
        id: c.id,
        chapterNumber: c.chapterNumber,
        title: c.title,
        status: c.status,
        wordCount: c.wordCount,
      })))
    }
  }

  async function handleDelete(chapterId: string) {
    if (!confirm('确定删除此章节？此操作不可撤销。')) return

    setDeleting(chapterId)
    try {
      const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        setChapters((prev) => {
          const deleted = prev.find((c) => c.id === chapterId)
          if (!deleted) return prev
          return prev
            .filter((c) => c.id !== chapterId)
            .map((c) =>
              c.chapterNumber > deleted.chapterNumber
                ? { ...c, chapterNumber: c.chapterNumber - 1 }
                : c
            )
        })
      } else {
        toast(`删除失败: ${data.error}`, 'error')
      }
    } catch {
      toast('删除失败', 'error')
    } finally {
      setDeleting(null)
    }
  }

  async function handleCreate() {
    if (!newTitle.trim()) return
    setAdding(true)
    try {
      const targetNumber = insertAfter !== null ? insertAfter + 1 : undefined
      const res = await fetch(`/api/books/${bookId}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          chapterNumber: targetNumber,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setNewTitle('')
        setInsertAfter(null)
        const listRes = await fetch(`/api/books/${bookId}/chapters`)
        const listData = await listRes.json()
        if (listData.success) {
          setChapters(listData.data.map((c: any) => ({
            id: c.id,
            chapterNumber: c.chapterNumber,
            title: c.title,
            status: c.status,
            wordCount: c.wordCount,
          })))
        }
      } else {
        toast(`创建失败: ${data.error}`, 'error')
      }
    } catch {
      toast('创建失败', 'error')
    } finally {
      setAdding(false)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setReordering(true)
    const oldIndex = chapters.findIndex((c) => c.id === active.id)
    const newIndex = chapters.findIndex((c) => c.id === over.id)

    const newChapters = arrayMove(chapters, oldIndex, newIndex).map((c, i) => ({
      ...c,
      chapterNumber: i + 1,
    }))
    setChapters(newChapters)

    try {
      const res = await fetch(`/api/books/${bookId}/chapters/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterIds: newChapters.map((c) => c.id) }),
      })
      const data = await res.json()
      if (!data.success) {
        toast(`排序失败: ${data.error}`, 'error')
        const rollbackRes = await fetch(`/api/books/${bookId}/chapters`)
        const rollbackData = await rollbackRes.json()
        if (rollbackData.success) {
          setChapters(rollbackData.data.map((c: any) => ({
            id: c.id,
            chapterNumber: c.chapterNumber,
            title: c.title,
            status: c.status,
            wordCount: c.wordCount,
          })))
        }
      }
    } catch {
      toast('排序请求失败', 'error')
    } finally {
      setReordering(false)
    }
  }

  return (
    <div className="space-y-2">
      {/* 新增章节 */}
      <div className="flex items-center gap-2 mb-3">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="新章节标题"
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleCreate()
            }
          }}
        />
        <select
          value={insertAfter ?? ''}
          onChange={(e) => setInsertAfter(e.target.value ? Number(e.target.value) : null)}
          className="rounded-md border bg-background px-2 py-2 text-sm"
        >
          <option value="">末尾追加</option>
          {chapters.map((ch) => (
            <option key={ch.id} value={ch.chapterNumber}>
              第{ch.chapterNumber}章后
            </option>
          ))}
        </select>
        <button
          onClick={handleCreate}
          disabled={adding || !newTitle.trim()}
          className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {adding ? '创建中...' : '新增'}
        </button>
        <button
          onClick={() => {
            setBatchMode((v) => !v)
            setSelectedIds(new Set())
          }}
          className={`rounded-md border px-3 py-2 text-sm transition-colors ${
            batchMode ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
          }`}
        >
          {batchMode ? '取消' : '批量'}
        </button>
      </div>

      {/* 批量操作栏 */}
      {batchMode && (
        <div className="flex items-center justify-between rounded-md border bg-muted px-4 py-2 mb-2">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">已选 {selectedIds.size} 章</span>
            <button onClick={selectAll} className="text-xs text-primary hover:underline">
              全选可定稿
            </button>
            <button onClick={clearSelection} className="text-xs text-primary hover:underline">
              清空
            </button>
          </div>
          <button
            onClick={batchFinalize}
            disabled={batchFinalizing || selectedIds.size === 0}
            className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {batchFinalizing ? '定稿中...' : '批量定稿'}
          </button>
        </div>
      )}

      {chapters.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无章节，先生成大纲</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={chapters.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className={`space-y-2 ${reordering ? 'opacity-50' : ''}`}>
              {chapters.map((ch) => (
                <SortableChapterItem
                  key={ch.id}
                  chapter={ch}
                  bookId={bookId}
                  onDelete={handleDelete}
                  deleting={deleting}
                  selected={selectedIds.has(ch.id)}
                  onSelect={toggleSelect}
                  batchMode={batchMode}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
