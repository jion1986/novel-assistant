'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from '@/components/toast'

interface MemoryItem {
  id: string
  type: string
  content: string
  importance: string
  isActive: boolean
  relatedChapter: string | null
  createdAt: string
}

interface Foreshadowing {
  id: string
  name: string
  description: string
  status: string
  setupChapter: string | null
  resolveChapter: string | null
}

interface Character {
  id: string
  name: string
  role: string
  currentStatus: string | null
}

const typeOptions = [
  { value: 'character', label: '角色' },
  { value: 'event', label: '事件' },
  { value: 'location', label: '地点' },
  { value: 'item', label: '物品' },
  { value: 'rule', label: '规则' },
  { value: 'relationship', label: '关系' },
]

const importanceOptions = [
  { value: 'critical', label: '关键' },
  { value: 'high', label: '重要' },
  { value: 'normal', label: '普通' },
  { value: 'low', label: '次要' },
]

function typeLabel(type: string): string {
  return typeOptions.find((o) => o.value === type)?.label || type
}

function fwStatusLabel(status: string): string {
  const map: Record<string, string> = {
    planted: '已埋伏',
    developed: '已发展',
    resolved: '已回收',
  }
  return map[status] || status
}

function fwStatusColor(status: string): string {
  const map: Record<string, string> = {
    planted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    developed: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    resolved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  }
  return map[status] || 'bg-muted'
}

function importanceColor(importance: string): string {
  const map: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    normal: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  }
  return map[importance] || 'bg-muted'
}

export default function MemoryPage() {
  const params = useParams()
  const bookId = params.bookId as string

  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([])
  const [foreshadowings, setForeshadowings] = useState<Foreshadowing[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)

  // 记忆编辑状态
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editType, setEditType] = useState('event')
  const [editImportance, setEditImportance] = useState('normal')

  // 新增记忆
  const [adding, setAdding] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [newType, setNewType] = useState('event')
  const [newImportance, setNewImportance] = useState('normal')

  // 伏笔编辑
  const [editingFwId, setEditingFwId] = useState<string | null>(null)
  const [fwForm, setFwForm] = useState({ name: '', description: '', status: 'planted', setupChapter: '', resolvePlan: '' })
  const [addingFw, setAddingFw] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/books/${bookId}/memory`)
      const data = await res.json()
      if (data.success) {
        setMemoryItems(data.data.memoryItems)
        setForeshadowings(data.data.foreshadowings)
        setCharacters(data.data.characters)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [bookId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 记忆 CRUD
  async function createMemory() {
    if (!newContent.trim()) return
    try {
      const res = await fetch(`/api/books/${bookId}/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent, type: newType, importance: newImportance }),
      })
      const data = await res.json()
      if (data.success) {
        setNewContent('')
        setAdding(false)
        loadData()
      } else {
        toast(`创建失败: ${data.error}`, 'error')
      }
    } catch {
      toast('创建失败', 'error')
    }
  }

  async function updateMemory(id: string) {
    try {
      const res = await fetch(`/api/books/${bookId}/memory?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent, type: editType, importance: editImportance }),
      })
      const data = await res.json()
      if (data.success) {
        setEditingId(null)
        loadData()
      } else {
        toast(`更新失败: ${data.error}`, 'error')
      }
    } catch {
      toast('更新失败', 'error')
    }
  }

  async function deleteMemory(id: string) {
    if (!confirm('确定删除此记忆条目？')) return
    try {
      const res = await fetch(`/api/books/${bookId}/memory?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) loadData()
    } catch {
      toast('删除失败', 'error')
    }
  }

  async function toggleMemoryActive(id: string, current: boolean) {
    try {
      const res = await fetch(`/api/books/${bookId}/memory?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !current }),
      })
      if (res.ok) loadData()
    } catch {
      toast('操作失败', 'error')
    }
  }

  // 伏笔 CRUD
  async function createForeshadowing() {
    if (!fwForm.name.trim() || !fwForm.description.trim()) return
    try {
      const res = await fetch(`/api/books/${bookId}/foreshadowings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fwForm),
      })
      const data = await res.json()
      if (data.success) {
        setFwForm({ name: '', description: '', status: 'planted', setupChapter: '', resolvePlan: '' })
        setAddingFw(false)
        loadData()
      } else {
        toast(`创建失败: ${data.error}`, 'error')
      }
    } catch {
      toast('创建失败', 'error')
    }
  }

  async function updateForeshadowing(id: string) {
    try {
      const res = await fetch(`/api/books/${bookId}/foreshadowings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fwForm),
      })
      const data = await res.json()
      if (data.success) {
        setEditingFwId(null)
        loadData()
      } else {
        toast(`更新失败: ${data.error}`, 'error')
      }
    } catch {
      toast('更新失败', 'error')
    }
  }

  async function deleteForeshadowing(id: string) {
    if (!confirm('确定删除此伏笔？')) return
    try {
      const res = await fetch(`/api/books/${bookId}/foreshadowings/${id}`, { method: 'DELETE' })
      if (res.ok) loadData()
    } catch {
      toast('删除失败', 'error')
    }
  }

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
        <Link href={`/books/${bookId}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回工作台
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6">记忆库</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 角色状态 */}
        <div className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold mb-4">角色状态</h2>
          {characters.length > 0 ? (
            <div className="space-y-3">
              {characters.map((char) => (
                <div key={char.id} className="rounded-md bg-muted p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{char.name}</span>
                    <span className="text-xs text-muted-foreground">{char.role}</span>
                  </div>
                  {char.currentStatus && (
                    <p className="text-xs text-muted-foreground mt-1">{char.currentStatus}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无角色数据</p>
          )}
        </div>

        {/* 记忆条目 */}
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">记忆条目</h2>
            <button
              onClick={() => setAdding(!adding)}
              className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {adding ? '取消' : '新增'}
            </button>
          </div>

          {adding && (
            <div className="mb-4 p-3 rounded-md bg-muted space-y-2">
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full rounded border bg-background px-2 py-1.5 text-sm"
              >
                {typeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                value={newImportance}
                onChange={(e) => setNewImportance(e.target.value)}
                className="w-full rounded border bg-background px-2 py-1.5 text-sm"
              >
                {importanceOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="记忆内容"
                className="w-full rounded border bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
              />
              <div className="flex gap-2">
                <button onClick={createMemory} className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90">保存</button>
                <button onClick={() => setAdding(false)} className="text-xs px-3 py-1.5 rounded border hover:bg-accent">取消</button>
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {memoryItems.map((item) => (
              <div key={item.id} className={`rounded-md p-3 border ${item.isActive ? 'bg-muted' : 'bg-muted/50 opacity-60'}`}>
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
                        className="rounded border bg-background px-2 py-1 text-sm"
                      >
                        {typeOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <select
                        value={editImportance}
                        onChange={(e) => setEditImportance(e.target.value)}
                        className="rounded border bg-background px-2 py-1 text-sm"
                      >
                        {importanceOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full rounded border bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => updateMemory(item.id)} className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90">保存</button>
                      <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1 rounded border hover:bg-accent">取消</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{typeLabel(item.type)}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${importanceColor(item.importance)}`}>{item.importance}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm">{item.content}</p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => {
                          setEditingId(item.id)
                          setEditContent(item.content)
                          setEditType(item.type)
                          setEditImportance(item.importance)
                        }}
                        className="text-xs px-2 py-0.5 rounded hover:bg-accent text-muted-foreground"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => toggleMemoryActive(item.id, item.isActive)}
                        className="text-xs px-2 py-0.5 rounded hover:bg-accent text-muted-foreground"
                      >
                        {item.isActive ? '归档' : '激活'}
                      </button>
                      <button
                        onClick={() => deleteMemory(item.id)}
                        className="text-xs px-2 py-0.5 rounded hover:bg-red-50 text-red-500"
                      >
                        删除
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 伏笔追踪 */}
        <div className="rounded-lg border bg-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">伏笔追踪</h2>
            <button
              onClick={() => setAddingFw(!addingFw)}
              className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {addingFw ? '取消' : '新增伏笔'}
            </button>
          </div>

          {addingFw && (
            <div className="mb-4 p-3 rounded-md bg-muted space-y-2 max-w-xl">
              <input
                value={fwForm.name}
                onChange={(e) => setFwForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="伏笔名称"
                className="w-full rounded border bg-background px-3 py-2 text-sm"
              />
              <textarea
                value={fwForm.description}
                onChange={(e) => setFwForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="伏笔描述"
                className="w-full rounded border bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
              />
              <input
                value={fwForm.setupChapter}
                onChange={(e) => setFwForm((f) => ({ ...f, setupChapter: e.target.value }))}
                placeholder="埋设章节（如：第3章）"
                className="w-full rounded border bg-background px-3 py-2 text-sm"
              />
              <input
                value={fwForm.resolvePlan}
                onChange={(e) => setFwForm((f) => ({ ...f, resolvePlan: e.target.value }))}
                placeholder="回收计划（如：第15章回收）"
                className="w-full rounded border bg-background px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button onClick={createForeshadowing} className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90">保存</button>
                <button onClick={() => { setAddingFw(false); setFwForm({ name: '', description: '', status: 'planted', setupChapter: '', resolvePlan: '' }) }} className="text-xs px-3 py-1.5 rounded border hover:bg-accent">取消</button>
              </div>
            </div>
          )}

          {foreshadowings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {foreshadowings.map((fw) => (
                <div key={fw.id} className="rounded-md bg-muted p-3">
                  {editingFwId === fw.id ? (
                    <div className="space-y-2">
                      <input
                        value={fwForm.name}
                        onChange={(e) => setFwForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full rounded border bg-background px-2 py-1 text-sm"
                      />
                      <textarea
                        value={fwForm.description}
                        onChange={(e) => setFwForm((f) => ({ ...f, description: e.target.value }))}
                        className="w-full rounded border bg-background px-2 py-1 text-sm min-h-[50px] resize-y"
                      />
                      <select
                        value={fwForm.status}
                        onChange={(e) => setFwForm((f) => ({ ...f, status: e.target.value }))}
                        className="w-full rounded border bg-background px-2 py-1 text-sm"
                      >
                        <option value="planted">已埋伏</option>
                        <option value="developed">已发展</option>
                        <option value="resolved">已回收</option>
                      </select>
                      <div className="flex gap-2">
                        <button onClick={() => updateForeshadowing(fw.id)} className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90">保存</button>
                        <button onClick={() => setEditingFwId(null)} className="text-xs px-2 py-1 rounded border hover:bg-accent">取消</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{fw.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${fwStatusColor(fw.status)}`}>
                          {fwStatusLabel(fw.status)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{fw.description}</p>
                      <div className="flex gap-3 mb-2 text-xs text-muted-foreground">
                        {fw.setupChapter && <span>埋设: {fw.setupChapter}</span>}
                        {fw.resolveChapter && <span>回收: {fw.resolveChapter}</span>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingFwId(fw.id)
                            setFwForm({
                              name: fw.name,
                              description: fw.description,
                              status: fw.status,
                              setupChapter: fw.setupChapter || '',
                              resolvePlan: '',
                            })
                          }}
                          className="text-xs px-2 py-0.5 rounded hover:bg-accent text-muted-foreground"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => deleteForeshadowing(fw.id)}
                          className="text-xs px-2 py-0.5 rounded hover:bg-red-50 text-red-500"
                        >
                          删除
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无伏笔数据</p>
          )}
        </div>
      </div>
    </main>
  )
}
