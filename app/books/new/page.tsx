'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from '@/components/toast'
import {
  GENRE_OPTIONS,
  STYLE_OPTIONS,
  WORD_COUNT_OPTIONS,
  CHAPTER_WORD_OPTIONS,
} from '@/lib/book-config'

export default function NewBookPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [selectedGenre, setSelectedGenre] = useState('')
  const [customGenre, setCustomGenre] = useState('')
  const [selectedStyles, setSelectedStyles] = useState<string[]>([])
  const [coreIdea, setCoreIdea] = useState('')
  const [showGenreCustom, setShowGenreCustom] = useState(false)

  const currentGenre = GENRE_OPTIONS.find((g) => g.value === selectedGenre)

  function toggleStyle(style: string) {
    setSelectedStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    )
  }

  function applyExampleIdea(idea: string) {
    setCoreIdea(idea)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)

    const form = e.currentTarget
    const formData = new FormData(form)

    const genre = showGenreCustom ? customGenre.trim() : selectedGenre
    if (!genre) {
      toast('请选择或输入题材', 'error')
      setSubmitting(false)
      return
    }

    const styleValue = selectedStyles.length > 0 ? selectedStyles.join('、') : (formData.get('style') as string)

    const body = {
      title: formData.get('title') as string,
      genre,
      coreIdea: formData.get('coreIdea') as string,
      targetWords: Number(formData.get('targetWords')),
      style: styleValue,
    }

    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        router.push(`/books/${data.data.id}`)
      } else {
        toast(`创建失败: ${data.error}`, 'error')
      }
    } catch (err) {
      toast(`请求失败: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回项目列表
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6">新建小说</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 小说标题 */}
        <div>
          <label className="block text-sm font-medium mb-2">小说标题</label>
          <input
            name="title"
            type="text"
            required
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="输入小说标题"
          />
        </div>

        {/* 题材选择 */}
        <div>
          <label className="block text-sm font-medium mb-2">题材</label>

          {!showGenreCustom ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-3">
              {GENRE_OPTIONS.map((genre) => (
                <button
                  key={genre.value}
                  type="button"
                  onClick={() => setSelectedGenre(genre.value)}
                  className={`rounded-md border px-3 py-2 text-sm text-left transition-colors ${
                    selectedGenre === genre.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'hover:bg-accent'
                  }`}
                  title={genre.description}
                >
                  <div className="font-medium">{genre.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {genre.description}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="mb-3">
              <input
                type="text"
                value={customGenre}
                onChange={(e) => setCustomGenre(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="输入自定义题材，如：蒸汽朋克、赛博武侠..."
                required
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setShowGenreCustom(!showGenreCustom)
              setSelectedGenre('')
            }}
            className="text-xs text-primary hover:underline"
          >
            {showGenreCustom ? '← 选择预设题材' : '+ 自定义题材'}
          </button>
        </div>

        {/* 题材示例 */}
        {currentGenre && currentGenre.exampleIdeas.length > 0 && (
          <div className="rounded-md border bg-muted/50 p-4">
            <h3 className="text-sm font-medium mb-2">{currentGenre.label} · 创意示例</h3>
            <div className="space-y-2">
              {currentGenre.exampleIdeas.map((idea, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applyExampleIdea(idea)}
                  className="block w-full text-left text-sm text-muted-foreground hover:text-foreground rounded px-2 py-1.5 hover:bg-accent transition-colors"
                >
                  {idea}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">点击示例可快速填充核心创意</p>
          </div>
        )}

        {/* 核心创意 */}
        <div>
          <label className="block text-sm font-medium mb-2">核心创意（一句话）</label>
          <textarea
            name="coreIdea"
            required
            value={coreIdea}
            onChange={(e) => setCoreIdea(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[100px] resize-y"
            placeholder="例如：一个普通上班族意外获得读取他人情绪的能力，卷入都市阴谋..."
          />
          <p className="text-xs text-muted-foreground mt-1">
            用一句话概括故事核心：主角是谁、遇到了什么事、有什么冲突
          </p>
        </div>

        {/* 目标字数 */}
        <div>
          <label className="block text-sm font-medium mb-2">目标字数</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {WORD_COUNT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="cursor-pointer"
              >
                <input
                  type="radio"
                  name="targetWords"
                  value={opt.value}
                  defaultChecked={opt.value === 300000}
                  className="sr-only peer"
                />
                <div className="rounded-md border px-3 py-2 text-sm text-center transition-colors peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary hover:bg-accent">
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.description}</div>
                  <div className="text-xs text-muted-foreground">{opt.chapterCount}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 文风偏好 */}
        <div>
          <label className="block text-sm font-medium mb-2">文风偏好（可多选）</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {STYLE_OPTIONS.map((style) => (
              <button
                key={style.value}
                type="button"
                onClick={() => toggleStyle(style.value)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  selectedStyles.includes(style.value)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'hover:bg-accent'
                }`}
                title={style.description}
              >
                {style.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="style" value={selectedStyles.join('、')} />
          {selectedStyles.length > 0 && (
            <p className="text-xs text-muted-foreground">
              已选：{selectedStyles.join('、')}
            </p>
          )}
        </div>

        {/* 提交 */}
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? '创建中...' : '创建项目'}
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border px-6 py-2 text-sm font-medium hover:bg-accent"
          >
            取消
          </Link>
        </div>
      </form>
    </main>
  )
}
