'use client'

import { useState } from 'react'
import { toast } from '@/components/toast'
import {
  estimateSettingCost,
  estimateCharactersCost,
  estimateOutlineCost,
  formatCost,
  formatTokens,
} from '@/lib/ai/costEstimator'

interface BookActionsProps {
  bookId: string
  hasSetting: boolean
  hasCharacters: boolean
  hasOutline: boolean
  coreIdea?: string
  storyBible?: string | null
  characterCount?: number
}

export function BookActions({
  bookId,
  hasSetting,
  hasCharacters,
  hasOutline,
  coreIdea = '',
  storyBible = '',
  characterCount = 0,
}: BookActionsProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<string>('')

  async function callGenerate(type: string) {
    setLoading(type)
    setMessage('')
    try {
      const res = await fetch(`/api/books/${bookId}/${type}/generate`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setMessage(`${type === 'setting' ? '设定' : type === 'characters' ? '人设' : '大纲'}生成成功！`)
        setTimeout(() => window.location.reload(), 800)
      } else {
        setMessage(`生成失败: ${data.error}`)
      }
    } catch (e) {
      setMessage(`请求失败: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(null)
    }
  }

  async function callGenerateChapterPlans() {
    setLoading('chapter_plans')
    setMessage('')
    try {
      const res = await fetch(`/api/books/${bookId}/chapters/generate-plans`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        toast(`已为 ${data.data.chapters.length} 章生成详细计划`, 'success')
        setTimeout(() => window.location.reload(), 800)
      } else {
        toast(`生成失败: ${data.error}`, 'error')
      }
    } catch (e) {
      toast(`请求失败: ${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      setLoading(null)
    }
  }

  const settingCost = estimateSettingCost(coreIdea)
  const charCost = estimateCharactersCost(storyBible || coreIdea)
  const outlineCost = estimateOutlineCost(storyBible || coreIdea, characterCount)

  return (
    <div className="space-y-3">
      <div>
        <button
          onClick={() => callGenerate('setting')}
          disabled={!!loading}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading === 'setting' ? '生成中...' : hasSetting ? '重新生成设定' : '生成设定'}
        </button>
        <p className="text-xs text-muted-foreground mt-1">
          预计 {formatTokens(settingCost.totalTokens)} tokens / {formatCost(settingCost.cost)}
        </p>
      </div>

      <div>
        <button
          onClick={() => callGenerate('characters')}
          disabled={!!loading || !hasSetting}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading === 'characters' ? '生成中...' : hasCharacters ? '重新生成人设' : '生成人设'}
        </button>
        <p className="text-xs text-muted-foreground mt-1">
          预计 {formatTokens(charCost.totalTokens)} tokens / {formatCost(charCost.cost)}
        </p>
      </div>

      <div>
        <button
          onClick={() => callGenerate('outline')}
          disabled={!!loading || !hasSetting || !hasCharacters}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading === 'outline' ? '生成中...' : hasOutline ? '重新生成大纲' : '生成大纲'}
        </button>
        <p className="text-xs text-muted-foreground mt-1">
          预计 {formatTokens(outlineCost.totalTokens)} tokens / {formatCost(outlineCost.cost)}
        </p>
      </div>

      {hasOutline && (
        <div className="pt-2 border-t">
          <button
            onClick={callGenerateChapterPlans}
            disabled={!!loading}
            className="w-full rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            {loading === 'chapter_plans' ? '生成中...' : '生成详细章节计划'}
          </button>
          <p className="text-xs text-muted-foreground mt-1">
            为未写章节补充场景规划、伏笔安排、预估字数
          </p>
        </div>
      )}

      {message && (
        <p className={`text-xs ${message.includes('失败') ? 'text-red-500' : 'text-green-600'}`}>{message}</p>
      )}
    </div>
  )
}
