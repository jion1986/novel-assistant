'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChapterActions } from '@/components/chapter-actions'
import { SaveDraftButton } from '@/components/save-draft-button'
import { FinalizeButton } from '@/components/finalize-button'
import dynamic from 'next/dynamic'

const MarkdownPreview = dynamic(
  () => import('@/components/markdown-preview').then((mod) => mod.MarkdownPreview),
  {
    ssr: false,
    loading: () => <p className="text-sm text-muted-foreground">加载预览中...</p>,
  }
)
import { MarkdownToolbar } from '@/components/markdown-toolbar'
import { AutoSaveIndicator } from '@/components/auto-save-indicator'
import { RewritePanel } from '@/components/rewrite-panel'
import { ChapterVersionHistory } from '@/components/chapter-version-history'
import { ContinuePanel } from '@/components/continue-panel'
import { toast } from '@/components/toast'

interface GenerationRun {
  id: string
  inputTokens: number
  outputTokens: number
  costEstimate: number | null
  createdAt: string
}

interface Chapter {
  id: string
  chapterNumber: number
  title: string
  chapterGoal: string | null
  outline: string | null
  draftContent: string | null
  finalContent: string | null
  status: string
  wordCount: number | null
  generationRuns: GenerationRun[]
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

type ViewMode = 'edit' | 'preview' | 'split'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function ChapterEditPage() {
  const params = useParams()
  const bookId = params.bookId as string
  const chapterId = params.chapterId as string

  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [chapterTitle, setChapterTitle] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [chapterGoal, setChapterGoal] = useState('')
  const [outline, setOutline] = useState('')
  const [editingMeta, setEditingMeta] = useState(false)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('edit')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [streaming, setStreaming] = useState(false)
  const [adjacentChapters, setAdjacentChapters] = useState<{
    prev?: { id: string; title: string; chapterNumber: number }
    next?: { id: string; title: string; chapterNumber: number }
  }>({})
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null)

  // Tab 键缩进
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newContent = content.substring(0, start) + '  ' + content.substring(end)
      setContent(newContent)
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      })
    }
  }

  // 同步滚动（分屏模式）
  function handleScroll(e: React.UIEvent<HTMLTextAreaElement>) {
    if (viewMode !== 'split' || !previewRef.current) return
    const textarea = e.currentTarget
    const ratio = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight)
    const preview = previewRef.current
    preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight)
  }

  useEffect(() => {
    async function loadChapter() {
      try {
        const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}`)
        const data = await res.json()
        if (data.success) {
          setChapter(data.data)
          setChapterTitle(data.data.title)
          setChapterGoal(data.data.chapterGoal || '')
          setOutline(data.data.outline || '')
          const initial = data.data.draftContent || data.data.finalContent || ''
          setContent(initial)
          setOriginalContent(initial)
        }

        // 加载相邻章节用于导航
        try {
          const listRes = await fetch(`/api/books/${bookId}/chapters`)
          const listData = await listRes.json()
          if (listData.success && Array.isArray(listData.data)) {
            const currentIndex = listData.data.findIndex((c: { id: string }) => c.id === chapterId)
            setAdjacentChapters({
              prev: currentIndex > 0 ? listData.data[currentIndex - 1] : undefined,
              next: currentIndex >= 0 && currentIndex < listData.data.length - 1 ? listData.data[currentIndex + 1] : undefined,
            })
          }
        } catch {
          // 忽略相邻章节加载失败
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    loadChapter()
  }, [bookId, chapterId])

  // 保存章节标题
  async function saveTitle() {
    if (!chapter || chapterTitle === chapter.title) {
      setEditingTitle(false)
      return
    }
    try {
      const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: chapterTitle }),
      })
      const data = await res.json()
      if (data.success) {
        setChapter((prev) => prev ? { ...prev, title: chapterTitle } : prev)
        setEditingTitle(false)
      } else {
        toast(`保存失败: ${data.error}`, 'error')
      }
    } catch {
      toast('保存失败', 'error')
    }
  }

  // 保存章节元数据（目标/大纲）
  async function saveMeta() {
    if (!chapter) return
    const hasChange = chapterGoal !== (chapter.chapterGoal || '') || outline !== (chapter.outline || '')
    if (!hasChange) {
      setEditingMeta(false)
      return
    }
    try {
      const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterGoal, outline }),
      })
      const data = await res.json()
      if (data.success) {
        setChapter((prev) => prev ? { ...prev, chapterGoal, outline } : prev)
        setEditingMeta(false)
      } else {
        toast(`保存失败: ${data.error}`, 'error')
      }
    } catch {
      toast('保存失败', 'error')
    }
  }

  // 自动保存（3秒防抖）
  const performAutoSave = useCallback(async () => {
    if (content === originalContent) return
    setSaveStatus('saving')
    try {
      const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftContent: content, status: 'edited' }),
      })
      const data = await res.json()
      if (data.success) {
        setOriginalContent(content)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 3000)
      } else {
        setSaveStatus('error')
      }
    } catch {
      setSaveStatus('error')
    }
  }, [content, originalContent, bookId, chapterId])

  useEffect(() => {
    if (content !== originalContent) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = setTimeout(() => {
        performAutoSave()
      }, 3000)
    }
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [content, originalContent, performAutoSave])

  // 离开页面警告
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (content !== originalContent) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [content, originalContent])

  // 快捷键 Ctrl+S
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        performAutoSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [performAutoSave])

  // 流式生成章节正文
  async function streamWrite() {
    if (streaming) return
    if (!confirm('确定使用流式生成？当前编辑内容将被覆盖。')) return

    setStreaming(true)
    setContent('')
    let fullContent = ''

    try {
      const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}/write-stream`)
      if (!res.ok) {
        const err = await res.text()
        toast(`生成失败: ${err}`, 'error')
        setStreaming(false)
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data:')) continue
          const jsonStr = line.slice(5).trim()
          if (jsonStr === '[DONE]') continue

          try {
            const parsed = JSON.parse(jsonStr)
            if (parsed.chunk) {
              fullContent += parsed.chunk
              setContent(fullContent)
            }
            if (parsed.done) {
              // 流结束，自动保存草稿
              await fetch(`/api/books/${bookId}/chapters/${chapterId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ draftContent: fullContent, status: 'ai_draft' }),
              })
              // 补录输出 tokens（中文字符约 1.5 tokens/字）
              const outputTokens = Math.round(fullContent.length * 1.5)
              await fetch(`/api/books/${bookId}/chapters/${chapterId}/write-stream/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ outputTokens }),
              })
              setOriginalContent(fullContent)
              setSaveStatus('saved')
              setTimeout(() => setSaveStatus('idle'), 3000)
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch (e) {
      toast(`请求失败: ${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      setStreaming(false)
    }
  }

  const handleToolbarAction = useCallback((action: string, placeholder?: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = content.slice(start, end)
    const text = selected || placeholder || ''

    let insertion = ''
    switch (action) {
      case 'h1':
        insertion = `# ${text}`
        break
      case 'h2':
        insertion = `## ${text}`
        break
      case 'h3':
        insertion = `### ${text}`
        break
      case 'bold':
        insertion = `**${text}**`
        break
      case 'italic':
        insertion = `*${text}*`
        break
      case 'quote':
        insertion = `> ${text}`
        break
      case 'list':
        insertion = `- ${text}`
        break
      case 'hr':
        insertion = '\n---\n'
        break
      case 'orderedList':
        insertion = `1. ${text}`
        break
      case 'task':
        insertion = `- [ ] ${text}`
        break
      case 'code':
        insertion = selected ? '```\n' + text + '\n```' : '```\n代码\n```'
        break
      case 'link':
        insertion = `[${text}](https://)`
        break
      case 'table':
        insertion = '\n| 列1 | 列2 |\n| --- | --- |\n| 内容 | 内容 |\n'
        break
      default:
        return
    }

    const newContent = content.slice(0, start) + insertion + content.slice(end)
    setContent(newContent)

    requestAnimationFrame(() => {
      textarea.focus()
      if (!selected && placeholder) {
        const phStart = start + insertion.indexOf(placeholder)
        textarea.setSelectionRange(phStart, phStart + placeholder.length)
      } else {
        const newCursor = start + insertion.length
        textarea.setSelectionRange(newCursor, newCursor)
      }
    })
  }, [content])

  const wordCount = content.replace(/\s/g, '').length

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">加载中...</p>
      </main>
    )
  }

  if (!chapter) {
    return (
      <main className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">章节不存在</p>
        <Link href={`/books/${bookId}`} className="text-sm text-primary hover:underline mt-2 inline-block">
          ← 返回工作台
        </Link>
      </main>
    )
  }

  const showEditor = viewMode === 'edit' || viewMode === 'split'
  const showPreview = viewMode === 'preview' || viewMode === 'split'

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href={`/books/${bookId}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回工作台
        </Link>
        <div className="flex items-center gap-4">
          {adjacentChapters.prev && (
            <Link
              href={`/books/${bookId}/chapters/${adjacentChapters.prev.id}`}
              className="text-sm text-primary hover:underline"
            >
              ← 上一章
            </Link>
          )}
          {adjacentChapters.next && (
            <Link
              href={`/books/${bookId}/chapters/${adjacentChapters.next.id}`}
              className="text-sm text-primary hover:underline"
            >
              下一章 →
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 主编辑区 */}
        <div className="lg:col-span-3">
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                {editingTitle ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold">第{chapter.chapterNumber}章</span>
                    <input
                      value={chapterTitle}
                      onChange={(e) => setChapterTitle(e.target.value)}
                      className="text-xl font-bold rounded border bg-background px-2 py-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          saveTitle()
                        }
                        if (e.key === 'Escape') {
                          setEditingTitle(false)
                          setChapterTitle(chapter.title)
                        }
                      }}
                      autoFocus
                    />
                    <button
                      onClick={saveTitle}
                      data-testid="save-title-btn"
                      className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => { setEditingTitle(false); setChapterTitle(chapter.title) }}
                      className="rounded border px-2 py-1 text-xs hover:bg-accent"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <h1
                    className="text-xl font-bold cursor-pointer hover:text-primary"
                    onClick={() => setEditingTitle(true)}
                    title="点击编辑标题"
                  >
                    第{chapter.chapterNumber}章 {chapter.title}
                  </h1>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
                  chapter.status === 'finalized' ? 'bg-green-100 text-green-700' :
                  chapter.status === 'ai_draft' ? 'bg-blue-100 text-blue-700' :
                  chapter.status === 'edited' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {statusLabel(chapter.status)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* 自动保存状态 */}
                <AutoSaveIndicator status={saveStatus} />

                {/* 视图模式切换 */}
                <div className="flex rounded-md border overflow-hidden">
                  {(['edit', 'preview', 'split'] as ViewMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`px-3 py-1.5 text-xs ${
                        viewMode === mode
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background hover:bg-muted'
                      }`}
                    >
                      {mode === 'edit' ? '编辑' : mode === 'preview' ? '预览' : '分屏'}
                    </button>
                  ))}
                </div>
                <button
                  onClick={streamWrite}
                  disabled={streaming}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                  title="流式生成（实时显示）"
                >
                  {streaming ? '生成中...' : '流式生成'}
                </button>
                <SaveDraftButton bookId={bookId} chapterId={chapterId} content={content} />
                <FinalizeButton bookId={bookId} chapterId={chapterId} content={content} />
              </div>
            </div>

            {/* 本章目标 & 大纲 */}
            {editingMeta ? (
              <div className="mb-4 p-3 rounded-md bg-muted space-y-3"
              >
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">本章目标</label>
                  <input
                    value={chapterGoal}
                    onChange={(e) => setChapterGoal(e.target.value)}
                    data-testid="chapter-goal-input"
                    className="w-full rounded border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">大纲</label>
                  <textarea
                    value={outline}
                    onChange={(e) => setOutline(e.target.value)}
                    data-testid="chapter-outline-input"
                    className="w-full rounded border bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveMeta}
                    data-testid="save-meta-btn"
                    className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => {
                      setEditingMeta(false)
                      setChapterGoal(chapter.chapterGoal || '')
                      setOutline(chapter.outline || '')
                    }}
                    className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">本章目标 / 大纲</span>
                  <button
                    onClick={() => setEditingMeta(true)}
                    data-testid="edit-meta-btn"
                    className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent transition-colors"
                  >
                    {chapter.chapterGoal || chapter.outline ? '编辑' : '添加'}
                  </button>
                </div>
                {(chapter.chapterGoal || chapter.outline) ? (
                  <div
                    className="rounded-md border bg-muted p-3 cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setEditingMeta(true)}
                    title="点击编辑"
                  >
                    {chapter.chapterGoal && (
                      <div className="text-sm mb-2">
                        <span className="font-medium">本章目标：</span>
                        <span className="text-muted-foreground">{chapter.chapterGoal}</span>
                      </div>
                    )}
                    {chapter.outline && (
                      <div className="text-sm whitespace-pre-line">
                        <span className="font-medium">大纲：</span>
                        <span className="text-muted-foreground">{chapter.outline}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="rounded-md border border-dashed p-3 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors text-center"
                    onClick={() => setEditingMeta(true)}
                  >
                    <span className="text-sm text-muted-foreground">点击添加本章目标和大纲</span>
                  </div>
                )}
              </div>
            )}

            {/* 工具栏 */}
            {showEditor && (
              <MarkdownToolbar onAction={handleToolbarAction} />
            )}

            {/* 编辑/预览区域 */}
            <div className={`grid gap-4 ${showEditor && showPreview ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {showEditor && (
                <textarea
                  ref={textareaRef}
                  data-editor="main"
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value)
                    if (e.target.value !== originalContent) setSaveStatus('idle')
                  }}
                  onKeyDown={handleKeyDown}
                  onScroll={handleScroll}
                  className="w-full min-h-[600px] rounded-md border bg-background px-4 py-3 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="章节内容将在这里显示..."
                  spellCheck={false}
                />
              )}

              {showPreview && (
                <div
                  ref={previewRef}
                  className="w-full min-h-[600px] rounded-md border bg-background px-4 py-3 overflow-y-auto"
                >
                  <MarkdownPreview content={content} />
                </div>
              )}
            </div>

            <div className="mt-2 text-xs text-muted-foreground text-right">
              {wordCount} 字
            </div>
          </div>
        </div>

        {/* 侧边栏 */}
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-medium mb-2">章节信息</h3>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>状态: {statusLabel(chapter.status)}</p>
              <p>字数: {wordCount}</p>
              <p>
                当篇成本:
                <span className="font-medium text-foreground">
                  {(() => {
                    const runs = chapter.generationRuns || []
                    const cost = runs.reduce((s, r) => s + (r.costEstimate || 0), 0)
                    const input = runs.reduce((s, r) => s + (r.inputTokens || 0), 0)
                    const output = runs.reduce((s, r) => s + (r.outputTokens || 0), 0)
                    if (cost < 0.01) return `${(cost * 1000).toFixed(1)} 厘 (${input}+${output} tokens)`
                    return `${cost.toFixed(2)} 元 (${input}+${output} tokens)`
                  })()}
                </span>
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-medium mb-2">操作</h3>
            <ChapterActions
              bookId={bookId}
              chapterId={chapterId}
              status={chapter.status}
              onContentReplace={(newContent) => {
                setContent(newContent)
                setOriginalContent(newContent)
                setSaveStatus('saved')
                setChapter((prev) => prev ? {
                  ...prev,
                  draftContent: newContent,
                  status: 'ai_draft',
                  wordCount: newContent.replace(/\s/g, '').length,
                } : prev)
                setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 3000)
              }}
            />
          </div>

          <ChapterVersionHistory
            bookId={bookId}
            chapterId={chapterId}
            onRestore={(newContent) => {
              setContent(newContent)
              setOriginalContent(newContent)
              setSaveStatus('idle')
            }}
          />

          <RewritePanel
            bookId={bookId}
            chapterId={chapterId}
            content={content}
            onReplace={(newContent) => {
              setContent(newContent)
              setSaveStatus('idle')
            }}
          />

          <ContinuePanel
            bookId={bookId}
            chapterId={chapterId}
            onAppend={(newContent) => {
              const appended = content + '\n' + newContent
              setContent(appended)
              setOriginalContent(appended)
            }}
          />

          {/* 快捷键提示 */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-medium mb-2 text-xs">快捷键</h3>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Ctrl + S — 保存草稿</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
