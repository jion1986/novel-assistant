'use client'

import { useState } from 'react'
import {
  estimateWriteChapterCost,
  formatCost,
  formatTokens,
} from '@/lib/ai/costEstimator'

interface ChapterActionsProps {
  bookId: string
  chapterId: string
  status: string
  onContentReplace?: (newContent: string) => void
}

interface ConsistencyIssue {
  severity: 'critical' | 'high' | 'medium' | 'low'
  type: string
  description: string
  location: string
  suggestion: string
}

interface ConsistencyResult {
  issues: ConsistencyIssue[]
  score?: { overall?: number; readability?: number }
  summary?: string
}

const severityLabel: Record<ConsistencyIssue['severity'], string> = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
}

const typeLabel: Record<string, string> = {
  character_drift: '人设漂移',
  setting_conflict: '设定冲突',
  timeline_error: '时间线',
  plot_hole: '剧情漏洞',
  foreshadowing_error: '伏笔问题',
  repetition: '重复问题',
  ai_tone: 'AI味',
}

function clip(value: string, length = 100): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (clean.length <= length) return clean
  return `${clean.slice(0, length)}...`
}

export function ChapterActions({ bookId, chapterId, status, onContentReplace }: ChapterActionsProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<string>('')
  const [checkResult, setCheckResult] = useState<ConsistencyResult | null>(null)

  async function callAction(type: string) {
    setLoading(type)
    setMessage('')
    try {
      const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}/${type}`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        if (type === 'check' && data.data) {
          setCheckResult(data.data)
          const issueCount = Array.isArray(data.data.issues) ? data.data.issues.length : 0
          const score = data.data.score?.overall
          setMessage(`检查完成：${issueCount} 个问题${typeof score === 'number' ? `，总分 ${score}` : ''}`)
        } else {
          setMessage('操作成功！')
        }
        if (type === 'write') setTimeout(() => window.location.reload(), 800)
      } else {
        setMessage(`失败: ${data.error}`)
      }
    } catch (e) {
      setMessage(`请求失败: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(null)
    }
  }

  async function rewriteByIssue(issue: ConsistencyIssue, index: number) {
    const loadingKey = `rewrite-issue-${index}`
    setLoading(loadingKey)
    setMessage('')
    try {
      const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}/rewrite-issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue }),
      })
      const data = await res.json()
      if (!data.success) {
        setMessage(`改写失败: ${data.error}`)
        return
      }

      const newContent = data.data?.chapter?.draftContent
      if (typeof newContent === 'string') {
        onContentReplace?.(newContent)
      }
      setMessage('已按检查建议改写为新的 AI 草稿')
      setCheckResult(null)
    } catch (e) {
      setMessage(`改写请求失败: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(null)
    }
  }

  // 预估写章节成本（基于典型上下文长度 3000 tokens）
  const writeCost = estimateWriteChapterCost(3000)

  return (
    <div className="space-y-3">
      <div>
        <button
          onClick={() => callAction('write')}
          disabled={!!loading}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading === 'write' ? '生成中...' : '生成正文'}
        </button>
        <p className="text-xs text-muted-foreground mt-1">
          预计 {formatTokens(writeCost.totalTokens)} tokens / {formatCost(writeCost.cost)}
        </p>
      </div>

      <button
        onClick={() => callAction('check')}
        disabled={!!loading}
        className="w-full rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
      >
        {loading === 'check' ? '检查中...' : '一致性检查'}
      </button>

      {status === 'finalized' && (
        <button
          onClick={() => callAction('extract-memory')}
          disabled={!!loading}
          className="w-full rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
        >
          {loading === 'extract-memory' ? '提取中...' : '提取记忆'}
        </button>
      )}

      {message && (
        <p className={`text-xs ${message.includes('失败') ? 'text-red-500' : 'text-green-600'}`}>{message}</p>
      )}

      {checkResult && (
        <div className="space-y-3 rounded-md border bg-muted/30 p-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium">检查结果</span>
              {typeof checkResult.score?.overall === 'number' && (
                <span className="text-muted-foreground">总分 {checkResult.score.overall}</span>
              )}
            </div>
            {checkResult.summary && (
              <p className="text-xs text-muted-foreground leading-relaxed">{checkResult.summary}</p>
            )}
          </div>

          {checkResult.issues.length === 0 ? (
            <p className="text-xs text-green-600">未发现明确问题。</p>
          ) : (
            <div className="space-y-2">
              {checkResult.issues.map((issue, index) => (
                <div key={`${issue.type}-${index}`} className="rounded-md border bg-background p-2 text-xs">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded border px-1.5 py-0.5 text-[11px]">
                      {severityLabel[issue.severity] || issue.severity}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                      {typeLabel[issue.type] || issue.type}
                    </span>
                  </div>
                  <p className="font-medium leading-relaxed">{issue.description}</p>
                  {issue.location && (
                    <p className="mt-1 text-muted-foreground">位置：{clip(issue.location)}</p>
                  )}
                  <p className="mt-1 text-muted-foreground">建议：{issue.suggestion}</p>
                  <button
                    type="button"
                    onClick={() => rewriteByIssue(issue, index)}
                    disabled={!!loading}
                    className="mt-2 w-full rounded-md border px-2 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                  >
                    {loading === `rewrite-issue-${index}` ? '改写中...' : '按建议改写'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
