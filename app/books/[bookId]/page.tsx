import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'
import { BookActions } from '@/components/book-actions'
import { StoryBibleEditor } from '@/components/story-bible-editor'
import { CharacterListEditor } from '@/components/character-list-editor'
import { BookInfoEditor } from '@/components/book-info-editor'
import { ChapterList } from '@/components/chapter-list'
import { SearchPanel } from '@/components/search-panel'
import { BookDeleteButton } from '@/components/book-delete-button'

interface PageProps {
  params: Promise<{ bookId: string }>
}

export default async function BookWorkplacePage({ params }: PageProps) {
  const session = await readSession()
  if (!session.isLoggedIn) {
    redirect('/login')
  }

  const { bookId } = await params

  const [book, generationRuns] = await Promise.all([
    prisma.book.findFirst({
      where: { id: bookId, userId: session.userId },
      include: {
        storyBible: true,
        characters: { orderBy: { orderIndex: 'asc' } },
        chapters: { orderBy: { chapterNumber: 'asc' } },
        memoryItems: { where: { isActive: true } },
        foreshadowings: true,
      },
    }),
    prisma.generationRun.findMany({
      where: { bookId },
      select: { inputTokens: true, outputTokens: true, costEstimate: true },
    }),
  ])

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

  const hasSetting = !!book.storyBible
  const hasCharacters = book.characters.length > 0
  const hasOutline = book.chapters.length > 0
  const totalCost = generationRuns.reduce((sum, r) => sum + (r.costEstimate || 0), 0)

  // 章节统计
  const statusCounts = book.chapters.reduce((acc, ch) => {
    acc[ch.status] = (acc[ch.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const totalWords = book.chapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0)
  const progressPercent = book.targetWords ? Math.min(100, Math.round((totalWords / book.targetWords) * 100)) : 0

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回项目列表
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：概览 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 基本信息 */}
          <div className="rounded-lg border bg-card p-6">
            <BookInfoEditor
              bookId={bookId}
              initial={{
                title: book.title,
                genre: book.genre,
                coreIdea: book.coreIdea,
                targetWords: book.targetWords,
                style: book.style,
              }}
            />
            <div className="mb-4">
              <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                {book.genre}
              </span>
            </div>

            {book.storyBible && (
              <StoryBibleEditor
                bookId={bookId}
                initial={{
                  worldSetting: book.storyBible.worldSetting || '',
                  storyType: book.storyBible.storyType || '',
                  tone: book.storyBible.tone || '',
                  coreConflict: book.storyBible.coreConflict || '',
                  powerSystem: book.storyBible.powerSystem,
                  rules: book.storyBible.rules,
                  forbiddenChanges: book.storyBible.forbiddenChanges,
                  styleGuide: book.storyBible.styleGuide,
                  sellingPoints: book.storyBible.sellingPoints,
                }}
              />
            )}
          </div>

          {/* 角色列表 */}
          {book.characters.length > 0 && (
            <CharacterListEditor
              bookId={bookId}
              characters={book.characters.map((c) => ({
                id: c.id,
                name: c.name,
                role: c.role,
                age: c.age,
                identity: c.identity,
                personality: c.personality,
                goal: c.goal,
                relationships: c.relationships,
                speakingStyle: c.speakingStyle,
                currentStatus: c.currentStatus,
                lockedFacts: c.lockedFacts,
              }))}
            />
          )}

          {/* 章节列表 */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">章节列表</h2>
            <ChapterList
              bookId={bookId}
              initialChapters={book.chapters.map((c) => ({
                id: c.id,
                chapterNumber: c.chapterNumber,
                title: c.title,
                status: c.status,
                wordCount: c.wordCount,
              }))}
            />
          </div>
        </div>

        {/* 右侧：快捷操作 */}
        <div className="space-y-4">
          <SearchPanel bookId={bookId} />

          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-medium mb-3">快捷操作</h3>
            <BookActions
              bookId={bookId}
              hasSetting={hasSetting}
              hasCharacters={hasCharacters}
              hasOutline={hasOutline}
              coreIdea={book.coreIdea}
              storyBible={book.storyBible?.worldSetting || ''}
              characterCount={book.characters.length}
            />
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-medium mb-2">项目信息</h3>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>目标字数: {book.targetWords?.toLocaleString() || '-'}</p>
              <p>文风: {book.style || '-'}</p>
              <p>章节数: {book.chapters.length}</p>
              <p>角色数: {book.characters.length}</p>
              <p className="pt-1 border-t mt-1">
                累计成本:
                <span className="font-medium text-foreground">
                  {totalCost < 0.01 ? `${(totalCost * 1000).toFixed(1)} 厘` : `${totalCost.toFixed(2)} 元`}
                </span>
              </p>
              <p className="text-xs">
                总 tokens:
                <span className="font-medium text-foreground">
                  {(() => {
                    const runs = generationRuns
                    const input = runs.reduce((s, r) => s + (r.inputTokens || 0), 0)
                    const output = runs.reduce((s, r) => s + (r.outputTokens || 0), 0)
                    return `${input.toLocaleString()} → ${output.toLocaleString()}`
                  })()}
                </span>
              </p>
            </div>
          </div>

          {/* 进度统计 */}
          {book.chapters.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-medium mb-3">写作进度</h3>

              {/* 字数进度条 */}
              {book.targetWords && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">字数</span>
                    <span className="font-medium">{totalWords.toLocaleString()} / {book.targetWords.toLocaleString()} ({progressPercent}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 章节状态分布 */}
              <div className="space-y-1.5">
                {[
                  { key: 'finalized', label: '已定稿', color: 'bg-green-500' },
                  { key: 'edited', label: '已编辑', color: 'bg-yellow-500' },
                  { key: 'ai_draft', label: 'AI草稿', color: 'bg-blue-500' },
                  { key: 'unwritten', label: '未写', color: 'bg-muted-foreground/30' },
                ].map(({ key, label, color }) => {
                  const count = statusCounts[key] || 0
                  const pct = book.chapters.length > 0 ? (count / book.chapters.length) * 100 : 0
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${color}`} />
                      <span className="text-xs text-muted-foreground w-12">{label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium w-6 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <Link
            href={`/books/${bookId}/memory`}
            className="block rounded-lg border bg-card p-4 hover:bg-accent"
          >
            <h3 className="font-medium">记忆库</h3>
            <p className="text-xs text-muted-foreground mt-1">查看和管理小说记忆</p>
          </Link>

          <Link
            href={`/books/${bookId}/export`}
            className="block rounded-lg border bg-card p-4 hover:bg-accent"
          >
            <h3 className="font-medium">导出小说</h3>
            <p className="text-xs text-muted-foreground mt-1">导出 Markdown / TXT</p>
          </Link>

          <Link
            href={`/books/${bookId}/stats`}
            className="block rounded-lg border bg-card p-4 hover:bg-accent"
          >
            <h3 className="font-medium">写作统计</h3>
            <p className="text-xs text-muted-foreground mt-1">字数、成本、进度看板</p>
          </Link>

          <div className="rounded-lg border border-red-100 bg-card p-4">
            <h3 className="font-medium text-red-600 mb-2 text-sm">危险操作</h3>
            <BookDeleteButton bookId={bookId} bookTitle={book.title} />
          </div>
        </div>
      </div>
    </main>
  )
}
