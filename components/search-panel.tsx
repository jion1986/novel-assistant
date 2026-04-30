'use client'

import { useState } from 'react'
import Link from 'next/link'

interface SearchResult {
  chapters: Array<{
    id: string
    chapterNumber: number
    title: string
    snippet: string
    status: string
  }>
  memoryItems: Array<{
    id: string
    type: string
    content: string
    snippet: string
  }>
  characters: Array<{
    id: string
    name: string
    role: string
    snippet: string
  }>
}

interface SearchPanelProps {
  bookId: string
}

function highlight(text: string, keyword: string) {
  if (!keyword) return text
  const parts = text.split(new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase() ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">{part}</mark>
    ) : (
      part
    )
  )
}

export function SearchPanel({ bookId }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchedQuery, setSearchedQuery] = useState('')

  async function handleSearch() {
    if (!query.trim() || query.trim().length < 2) return
    setLoading(true)
    setSearchedQuery(query.trim())
    try {
      const res = await fetch(`/api/books/${bookId}/search?q=${encodeURIComponent(query.trim())}`)
      const data = await res.json()
      if (data.success) {
        setResults(data.data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const totalCount = (results?.chapters?.length || 0) + (results?.memoryItems?.length || 0) + (results?.characters?.length || 0)

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-medium mb-3">全文搜索</h3>
      <div className="flex gap-2 mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索章节、记忆、角色..."
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSearch()
            }
          }}
        />
        <button
          onClick={handleSearch}
          disabled={loading || query.trim().length < 2}
          className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? '搜索中...' : '搜索'}
        </button>
      </div>

      {results && (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {totalCount === 0 ? (
            <p className="text-sm text-muted-foreground">未找到匹配结果</p>
          ) : (
            <>
              {results.chapters.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-1.5">章节 ({results.chapters.length})</h4>
                  <div className="space-y-1.5">
                    {results.chapters.map((ch) => (
                      <Link
                        key={ch.id}
                        href={`/books/${bookId}/chapters/${ch.id}`}
                        className="block rounded-md bg-muted p-2 hover:bg-accent text-sm"
                      >
                        <span className="font-medium">第{ch.chapterNumber}章 {ch.title}</span>
                        {ch.snippet && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {highlight(ch.snippet, searchedQuery)}
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {results.memoryItems.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-1.5">记忆 ({results.memoryItems.length})</h4>
                  <div className="space-y-1.5">
                    {results.memoryItems.map((m) => (
                      <div key={m.id} className="rounded-md bg-muted p-2 text-sm">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{m.type}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{highlight(m.snippet, searchedQuery)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results.characters.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-1.5">角色 ({results.characters.length})</h4>
                  <div className="space-y-1.5">
                    {results.characters.map((c) => (
                      <div key={c.id} className="rounded-md bg-muted p-2 text-sm">
                        <span className="font-medium">{c.name}</span>
                        {c.snippet && (
                          <p className="text-xs text-muted-foreground mt-0.5">{highlight(c.snippet, searchedQuery)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
