import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'

interface PageProps {
  params: Promise<{ bookId: string }>
}

function statusBarColor(status: string): string {
  const map: Record<string, string> = {
    unwritten: 'bg-muted-foreground/30',
    ai_draft: 'bg-blue-500',
    edited: 'bg-yellow-500',
    finalized: 'bg-green-500',
  }
  return map[status] || 'bg-muted'
}

export default async function StatsPage({ params }: PageProps) {
  const session = await readSession()
  if (!session.isLoggedIn) {
    redirect('/login')
  }

  const { bookId } = await params

  const book = await prisma.book.findFirst({
    where: { id: bookId, userId: session.userId },
    include: {
      chapters: { orderBy: { chapterNumber: 'asc' } },
      generationRuns: { orderBy: { createdAt: 'desc' } },
      characters: true,
    },
  })

  if (!book) {
    return (
      <main className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">小说项目不存在</p>
        <Link href="/" className="text-sm text-primary hover:underline mt-2 inline-block">
          ← 返回项目列表
        </Link>
      </main>
    )
  }

  // 总体统计
  const totalWords = book.chapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0)
  const statusCounts = book.chapters.reduce((acc, ch) => {
    acc[ch.status] = (acc[ch.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const finalizedCount = statusCounts['finalized'] || 0
  const editedCount = statusCounts['edited'] || 0
  const aiDraftCount = statusCounts['ai_draft'] || 0
  const unwrittenCount = statusCounts['unwritten'] || 0
  const writtenByHuman = finalizedCount + editedCount
  const writtenByAI = aiDraftCount

  const progressPercent = book.targetWords ? Math.min(100, Math.round((totalWords / book.targetWords) * 100)) : 0

  // 成本统计
  const totalCost = book.generationRuns.reduce((sum, r) => sum + (r.costEstimate || 0), 0)
  const totalInputTokens = book.generationRuns.reduce((sum, r) => sum + (r.inputTokens || 0), 0)
  const totalOutputTokens = book.generationRuns.reduce((sum, r) => sum + (r.outputTokens || 0), 0)

  const costByTask = book.generationRuns.reduce((acc, r) => {
    acc[r.taskType] = (acc[r.taskType] || 0) + (r.costEstimate || 0)
    return acc
  }, {} as Record<string, number>)

  const taskTypeLabels: Record<string, string> = {
    setting: '设定生成',
    characters: '人设生成',
    outline: '大纲生成',
    chapter_plan: '章节计划',
    write: '章节写作',
    rewrite: '改写',
    extract_memory: '记忆提取',
    check_consistency: '一致性检查',
  }

  // 最近活动（按天聚合）
  const runsByDay = book.generationRuns.reduce((acc, r) => {
    const day = r.createdAt.toISOString().slice(0, 10)
    if (!acc[day]) acc[day] = { count: 0, cost: 0, tokens: 0 }
    acc[day].count++
    acc[day].cost += r.costEstimate || 0
    acc[day].tokens += (r.inputTokens || 0) + (r.outputTokens || 0)
    return acc
  }, {} as Record<string, { count: number; cost: number; tokens: number }>)

  const recentDays = Object.entries(runsByDay)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 14)

  // 字数分布（按章节）
  const wordCountDistribution = book.chapters
    .filter((c) => c.wordCount && c.wordCount > 0)
    .map((c) => ({
      number: c.chapterNumber,
      title: c.title,
      words: c.wordCount || 0,
      status: c.status,
    }))

  const maxWordsInChapter = Math.max(...wordCountDistribution.map((c) => c.words), 1)

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href={`/books/${bookId}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回工作台
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6">
        《{book.title}》写作统计
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：核心指标 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 字数进度 */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">字数进度</h2>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-bold">{totalWords.toLocaleString()}</span>
              <span className="text-muted-foreground">/ {book.targetWords?.toLocaleString() || '-'} 字</span>
              {book.targetWords && (
                <span className="text-sm text-muted-foreground ml-auto">{progressPercent}%</span>
              )}
            </div>
            {book.targetWords && (
              <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
            <div className="grid grid-cols-4 gap-4 mt-4 text-center">
              {[
                { label: '已定稿', count: finalizedCount, color: 'text-green-600' },
                { label: '已编辑', count: editedCount, color: 'text-yellow-600' },
                { label: 'AI草稿', count: aiDraftCount, color: 'text-blue-600' },
                { label: '未写', count: unwrittenCount, color: 'text-muted-foreground' },
              ].map(({ label, count, color }) => (
                <div key={label}>
                  <div className={`text-xl font-bold ${color}`}>{count}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* AI vs 人工 */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">写作来源分布</h2>
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <div className="flex h-6 rounded-full overflow-hidden">
                  {writtenByHuman > 0 && (
                    <div
                      className="bg-yellow-500"
                      style={{
                        width: `${(writtenByHuman / book.chapters.length) * 100}%`,
                      }}
                    />
                  )}
                  {writtenByAI > 0 && (
                    <div
                      className="bg-blue-500"
                      style={{
                        width: `${(writtenByAI / book.chapters.length) * 100}%`,
                      }}
                    />
                  )}
                  {unwrittenCount > 0 && (
                    <div
                      className="bg-muted-foreground/20"
                      style={{
                        width: `${(unwrittenCount / book.chapters.length) * 100}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-6 mt-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span>人工写作（{writtenByHuman} 章）</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>AI生成（{writtenByAI} 章）</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-muted-foreground/20" />
                <span>未写（{unwrittenCount} 章）</span>
              </div>
            </div>
          </div>

          {/* 单章字数分布 */}
          {wordCountDistribution.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4">单章字数分布</h2>
              <div className="space-y-2">
                {wordCountDistribution.slice(0, 20).map((ch) => (
                  <div key={ch.number} className="flex items-center gap-3 text-sm">
                    <span className="w-16 text-muted-foreground text-xs shrink-0">
                      第{ch.number}章
                    </span>
                    <div className="flex-1 h-5 rounded bg-muted overflow-hidden relative">
                      <div
                        className={`h-full ${statusBarColor(ch.status)}`}
                        style={{ width: `${(ch.words / maxWordsInChapter) * 100}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-xs text-muted-foreground shrink-0">
                      {ch.words.toLocaleString()} 字
                    </span>
                  </div>
                ))}
                {wordCountDistribution.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    还有 {wordCountDistribution.length - 20} 章...
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 右侧：成本与活动 */}
        <div className="space-y-6">
          {/* 成本概览 */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">AI 成本概览</h2>
            <div className="text-3xl font-bold mb-1">
              {totalCost < 0.01 ? `${(totalCost * 1000).toFixed(1)} 厘` : `${totalCost.toFixed(2)} 元`}
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {totalInputTokens.toLocaleString()} → {totalOutputTokens.toLocaleString()} tokens
            </p>

            <div className="space-y-2">
              {Object.entries(costByTask)
                .sort((a, b) => b[1] - a[1])
                .map(([task, cost]) => (
                  <div key={task} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {taskTypeLabels[task] || task}
                    </span>
                    <span className="font-medium">
                      {cost < 0.01 ? `${(cost * 1000).toFixed(1)} 厘` : `${cost.toFixed(2)} 元`}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* 最近活动 */}
          {recentDays.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4">最近活动（14天）</h2>
              <div className="space-y-3">
                {recentDays.map(([day, data]) => (
                  <div key={day} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{day.slice(5)}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs">{data.count} 次</span>
                      <span className="text-xs text-muted-foreground">
                        {data.tokens.toLocaleString()} tokens
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 项目信息 */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">项目信息</h2>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>题材: {book.genre}</p>
              <p>角色数: {book.characters.length}</p>
              <p>章节数: {book.chapters.length}</p>
              <p>AI 调用次数: {book.generationRuns.length}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
