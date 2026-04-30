'use client'

import { useState } from 'react'
import { toast } from '@/components/toast'

interface StoryBible {
  worldSetting: string
  storyType: string
  tone: string
  coreConflict: string
  powerSystem: string | null
  rules: string | null
  forbiddenChanges: string | null
  styleGuide: string | null
  sellingPoints: string | null
}

interface StoryBibleEditorProps {
  bookId: string
  initial: StoryBible
}

export function StoryBibleEditor({ bookId, initial }: StoryBibleEditorProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<StoryBible>(initial)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/books/${bookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyBible: data }),
      })
      const result = await res.json()
      if (result.success) {
        setSaved(true)
        setEditing(false)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch {
      toast('保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const fields = [
    { key: 'worldSetting' as const, label: '世界观', placeholder: '故事发生的世界背景...' },
    { key: 'storyType' as const, label: '故事类型', placeholder: '如：都市重生、玄幻升级' },
    { key: 'tone' as const, label: '整体基调', placeholder: '如：热血、悬疑、轻松' },
    { key: 'coreConflict' as const, label: '核心冲突', placeholder: '全书最核心的矛盾与张力来源...' },
    { key: 'powerSystem' as const, label: '力量体系', placeholder: '如有超自然/武力体系，在此描述...' },
    { key: 'rules' as const, label: '世界规则', placeholder: '这个世界的特殊规则或限制...' },
    { key: 'forbiddenChanges' as const, label: '禁止改动项', placeholder: '一旦确定就不能修改的核心设定...' },
    { key: 'styleGuide' as const, label: '文风指南', placeholder: '对叙事风格的统一要求...' },
    { key: 'sellingPoints' as const, label: '卖点', placeholder: '本书的差异化亮点和吸引读者的核心...' },
  ]

  if (editing) {
    return (
      <div className="space-y-3">
        {fields.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            {key === 'worldSetting' || key === 'coreConflict' || key === 'rules' || key === 'forbiddenChanges' || key === 'styleGuide' || key === 'sellingPoints' ? (
              <textarea
                value={data[key] || ''}
                onChange={(e) => setData((d) => ({ ...d, [key]: e.target.value }))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
                placeholder={placeholder}
              />
            ) : (
              <input
                value={data[key] || ''}
                onChange={(e) => setData((d) => ({ ...d, [key]: e.target.value }))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder={placeholder}
              />
            )}
          </div>
        ))}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
          <button
            onClick={() => { setEditing(false); setData(initial) }}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            取消
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2 text-sm">
      {fields.map(({ key, label }) =>
        data[key] ? (
          <p key={key}>
            <span className="font-medium">{label}：</span>
            <span className="text-muted-foreground">{data[key]}</span>
          </p>
        ) : null
      )}
      <button
        onClick={() => setEditing(true)}
        className="mt-2 rounded-md border px-3 py-1.5 text-xs hover:bg-accent transition-colors"
      >
        编辑设定
      </button>
      {saved && <span className="text-xs text-green-600 ml-2">已保存</span>}
    </div>
  )
}
