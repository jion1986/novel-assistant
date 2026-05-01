'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from '@/components/toast'

interface PromptVersion {
  id: string
  taskType: string
  version: string
  content: string
  isActive: boolean
  note: string | null
  createdAt: string
}

const taskTypeOptions = [
  { value: 'write', label: '写章节' },
  { value: 'rewrite', label: '改写' },
  { value: 'setting', label: '生成设定' },
  { value: 'characters', label: '生成人设' },
  { value: 'outline', label: '生成大纲' },
  { value: 'extract_memory', label: '提取记忆' },
  { value: 'check_consistency', label: '一致性检查' },
  { value: 'continue', label: '续写' },
]

export default function PromptsPage() {
  const [versions, setVersions] = useState<PromptVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ taskType: 'write', version: 'v1.0', content: '', note: '' })
  const [editingId, setEditingId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/prompt-versions')
      const data = await res.json()
      if (data.success) setVersions(data.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadData()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  async function createVersion() {
    if (!form.content.trim()) return
    try {
      const res = await fetch('/api/prompt-versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) {
        setAdding(false)
        setForm({ taskType: 'write', version: 'v1.0', content: '', note: '' })
        loadData()
      } else {
        toast(`创建失败: ${data.error}`, 'error')
      }
    } catch {
      toast('创建失败', 'error')
    }
  }

  async function updateVersion(id: string, updates: Partial<PromptVersion>) {
    try {
      const res = await fetch(`/api/prompt-versions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) loadData()
    } catch {
      toast('更新失败', 'error')
    }
  }

  async function deleteVersion(id: string) {
    if (!confirm('确定删除此版本？')) return
    try {
      const res = await fetch(`/api/prompt-versions/${id}`, { method: 'DELETE' })
      if (res.ok) loadData()
    } catch {
      toast('删除失败', 'error')
    }
  }

  const grouped = versions.reduce((acc, v) => {
    if (!acc[v.taskType]) acc[v.taskType] = []
    acc[v.taskType].push(v)
    return acc
  }, {} as Record<string, PromptVersion[]>)

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">加载中...</p>
      </main>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回首页
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Prompt 版本管理</h1>
        <button
          onClick={() => setAdding(!adding)}
          className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          {adding ? '取消' : '新增版本'}
        </button>
      </div>

      {adding && (
        <div className="rounded-lg border bg-card p-4 mb-6 space-y-3 max-w-2xl">
          <div className="flex gap-3">
            <select
              value={form.taskType}
              onChange={(e) => setForm((f) => ({ ...f, taskType: e.target.value }))}
              className="rounded border bg-background px-2 py-2 text-sm"
            >
              {taskTypeOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              value={form.version}
              onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
              placeholder="版本号"
              className="rounded border bg-background px-3 py-2 text-sm w-32"
            />
          </div>
          <textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            placeholder="Prompt 内容"
            className="w-full rounded border bg-background px-3 py-2 text-sm min-h-[200px] resize-y"
          />
          <input
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="备注"
            className="w-full rounded border bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button onClick={createVersion} className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90">保存</button>
            <button onClick={() => setAdding(false)} className="text-sm px-3 py-1.5 rounded border hover:bg-accent">取消</button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {taskTypeOptions.map((type) => {
          const items = grouped[type.value] || []
          if (items.length === 0) return null
          return (
            <div key={type.value} className="rounded-lg border bg-card p-5">
              <h2 className="font-semibold mb-3">{type.label}</h2>
              <div className="space-y-2">
                {items.map((v) => (
                  <div key={v.id} className={`rounded-md p-3 border ${v.isActive ? 'bg-muted border-primary/30' : 'bg-muted/50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{v.version}</span>
                        {v.isActive && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">已激活</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!v.isActive && (
                          <button
                            onClick={() => updateVersion(v.id, { isActive: true })}
                            className="text-xs px-2 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            激活
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingId(editingId === v.id ? null : v.id)
                            if (editingId !== v.id) {
                              setForm({ taskType: v.taskType, version: v.version, content: v.content, note: v.note || '' })
                            }
                          }}
                          className="text-xs px-2 py-0.5 rounded border hover:bg-accent"
                        >
                          {editingId === v.id ? '收起' : '编辑'}
                        </button>
                        <button
                          onClick={() => deleteVersion(v.id)}
                          className="text-xs px-2 py-0.5 rounded hover:bg-red-50 text-red-500"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                    {v.note && <p className="text-xs text-muted-foreground mb-1">{v.note}</p>}
                    {editingId === v.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={form.content}
                          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                          className="w-full rounded border bg-background px-3 py-2 text-sm min-h-[150px] resize-y"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => { updateVersion(v.id, { content: form.content, note: form.note }); setEditingId(null) }} className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground">保存</button>
                          <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1 rounded border hover:bg-accent">取消</button>
                        </div>
                      </div>
                    ) : (
                      <pre className="text-xs bg-background p-2 rounded overflow-x-auto max-h-[150px] overflow-y-auto">{v.content}</pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}
