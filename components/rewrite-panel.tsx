'use client'

import { useState, useRef } from 'react'
import { toast } from '@/components/toast'

interface RewritePanelProps {
  bookId: string
  chapterId: string
  content: string
  onReplace: (newContent: string) => void
}

export function RewritePanel({ bookId, chapterId, content, onReplace }: RewritePanelProps) {
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [result, setResult] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  function captureSelection() {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null
    if (!textarea) return
    textareaRef.current = textarea
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value.slice(start, end)
    setSelectedText(text)
    setResult('')
  }

  async function handleRewrite() {
    if (!selectedText.trim() || !instruction.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: `将以下段落按照要求改写：${instruction}\n\n原文：${selectedText}`,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setResult(data.data.content || data.data.rewrittenContent || '')
      } else {
        toast(`改写失败: ${data.error}`, 'error')
      }
    } catch {
      toast('改写请求失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  function applyRewrite() {
    if (!result || !textareaRef.current) return
    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newContent = content.slice(0, start) + result + content.slice(end)
    onReplace(newContent)
    setSelectedText('')
    setResult('')
    setInstruction('')
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-medium mb-3">AI 改写</h3>
      <div className="space-y-3">
        <button
          onClick={captureSelection}
          className="w-full rounded-md border px-3 py-2 text-sm hover:bg-accent text-left"
        >
          {selectedText ? `已选中 ${selectedText.length} 字` : '1. 先在编辑器中选中文字，再点击这里'}
        </button>

        {selectedText && (
          <>
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded max-h-[80px] overflow-y-auto">
              {selectedText}
            </div>
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="2. 输入改写要求（如：润色、扩写、精简）"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={handleRewrite}
              disabled={loading || !instruction.trim()}
              className="w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? '改写中...' : '3. 开始改写'}
            </button>
          </>
        )}

        {result && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded max-h-[120px] overflow-y-auto whitespace-pre-line">
              {result}
            </div>
            <div className="flex gap-2">
              <button
                onClick={applyRewrite}
                className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
              >
                应用改写
              </button>
              <button
                onClick={() => setResult('')}
                className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
