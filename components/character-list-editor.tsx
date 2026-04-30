'use client'

import { useState } from 'react'
import { toast } from '@/components/toast'

interface Character {
  id: string
  name: string
  role: string
  age: string | null
  identity: string | null
  personality: string | null
  goal: string | null
  relationships: string | null
  speakingStyle: string | null
  currentStatus: string | null
  lockedFacts: string | null
}

interface CharacterListEditorProps {
  bookId: string
  characters: Character[]
}

const roleOptions = [
  { value: 'protagonist', label: '主角' },
  { value: 'deuteragonist', label: '配角' },
  { value: 'supporting', label: '群像' },
  { value: 'antagonist', label: '反派' },
]

function roleLabel(role: string) {
  return roleOptions.find((r) => r.value === role)?.label || role
}

export function CharacterListEditor({ bookId, characters: initialCharacters }: CharacterListEditorProps) {
  const [characters, setCharacters] = useState(initialCharacters)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function saveCharacter(char: Character) {
    setSaving(true)
    try {
      const res = await fetch(`/api/books/${bookId}/characters/${char.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(char),
      })
      const data = await res.json()
      if (data.success) {
        setCharacters((prev) => prev.map((c) => (c.id === char.id ? { ...c, ...data.data } : c)))
        setEditingId(null)
      } else {
        toast(`保存失败: ${data.error}`, 'error')
      }
    } catch {
      toast('保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (characters.length === 0) return null

  const editingChar = characters.find((c) => c.id === editingId)

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold mb-4">角色</h2>

      {editingId && editingChar && (
        <div className="mb-4 rounded-md border bg-background p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">名字</label>
              <input
                value={editingChar.name}
                onChange={(e) =>
                  setCharacters((prev) =>
                    prev.map((c) => (c.id === editingId ? { ...c, name: e.target.value } : c))
                  )
                }
                className="w-full rounded border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">角色定位</label>
              <select
                value={editingChar.role}
                onChange={(e) =>
                  setCharacters((prev) =>
                    prev.map((c) => (c.id === editingId ? { ...c, role: e.target.value } : c))
                  )
                }
                className="w-full rounded border bg-background px-2 py-1.5 text-sm"
              >
                {roleOptions.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">年龄</label>
              <input
                value={editingChar.age || ''}
                onChange={(e) =>
                  setCharacters((prev) =>
                    prev.map((c) => (c.id === editingId ? { ...c, age: e.target.value } : c))
                  )
                }
                className="w-full rounded border bg-background px-2 py-1.5 text-sm"
                placeholder="如：二十多岁"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">身份/职业</label>
              <input
                value={editingChar.identity || ''}
                onChange={(e) =>
                  setCharacters((prev) =>
                    prev.map((c) => (c.id === editingId ? { ...c, identity: e.target.value } : c))
                  )
                }
                className="w-full rounded border bg-background px-2 py-1.5 text-sm"
                placeholder="如：设计师"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">性格特点</label>
            <textarea
              value={editingChar.personality || ''}
              onChange={(e) =>
                setCharacters((prev) =>
                  prev.map((c) => (c.id === editingId ? { ...c, personality: e.target.value } : c))
                )
              }
              className="w-full rounded border bg-background px-2 py-1.5 text-sm min-h-[60px] resize-y"
              placeholder="性格描述"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">角色目标</label>
            <textarea
              value={editingChar.goal || ''}
              onChange={(e) =>
                setCharacters((prev) =>
                  prev.map((c) => (c.id === editingId ? { ...c, goal: e.target.value } : c))
                )
              }
              className="w-full rounded border bg-background px-2 py-1.5 text-sm min-h-[60px] resize-y"
              placeholder="该角色在故事中的核心目标"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">人物关系</label>
            <textarea
              value={editingChar.relationships || ''}
              onChange={(e) =>
                setCharacters((prev) =>
                  prev.map((c) => (c.id === editingId ? { ...c, relationships: e.target.value } : c))
                )
              }
              className="w-full rounded border bg-background px-2 py-1.5 text-sm min-h-[60px] resize-y"
              placeholder="与其他角色的关系"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">说话风格</label>
            <input
              value={editingChar.speakingStyle || ''}
              onChange={(e) =>
                setCharacters((prev) =>
                  prev.map((c) => (c.id === editingId ? { ...c, speakingStyle: e.target.value } : c))
                )
              }
              className="w-full rounded border bg-background px-2 py-1.5 text-sm"
              placeholder="如：干练直接，偶尔 sarcastic"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">当前状态</label>
            <textarea
              value={editingChar.currentStatus || ''}
              onChange={(e) =>
                setCharacters((prev) =>
                  prev.map((c) => (c.id === editingId ? { ...c, currentStatus: e.target.value } : c))
                )
              }
              className="w-full rounded border bg-background px-2 py-1.5 text-sm min-h-[60px] resize-y"
              placeholder="随剧情动态更新的当前状态"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">不可改动的设定（锁定事实）</label>
            <textarea
              value={editingChar.lockedFacts || ''}
              onChange={(e) =>
                setCharacters((prev) =>
                  prev.map((c) => (c.id === editingId ? { ...c, lockedFacts: e.target.value } : c))
                )
              }
              className="w-full rounded border bg-background px-2 py-1.5 text-sm min-h-[60px] resize-y"
              placeholder="已确定、不可后续修改的设定"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => saveCharacter(editingChar)}
              disabled={saving}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {characters.map((char) => (
          <button
            key={char.id}
            onClick={() => setEditingId(char.id)}
            className={`text-sm px-3 py-1.5 rounded-md text-left transition-colors ${
              editingId === char.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80'
            }`}
            title={char.identity || char.name}
          >
            {char.name}
            <span className="text-xs opacity-70 ml-1">({roleLabel(char.role)})</span>
          </button>
        ))}
      </div>

      {editingId && editingChar && (
        <div className="mt-4 rounded-md bg-muted p-3 text-sm space-y-1">
          {editingChar.age && <p><span className="font-medium">年龄：</span>{editingChar.age}</p>}
          {editingChar.identity && <p><span className="font-medium">身份：</span>{editingChar.identity}</p>}
          {editingChar.personality && <p><span className="font-medium">性格：</span>{editingChar.personality}</p>}
          {editingChar.goal && <p><span className="font-medium">目标：</span>{editingChar.goal}</p>}
          {editingChar.currentStatus && <p><span className="font-medium">当前状态：</span>{editingChar.currentStatus}</p>}
        </div>
      )}
    </div>
  )
}
