import fs from 'fs'
import path from 'path'

const LOCAL_NOVELS_DIR = path.join(process.cwd(), 'local-novels')

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim()
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export interface SaveChapterToLocalInput {
  bookTitle: string
  chapterNumber: number
  chapterTitle: string
  content: string
  status: string
  wordCount: number | null
  savedAt?: Date
}

/**
 * 将章节内容自动保存到本地 markdown 文件
 */
export function saveChapterToLocal(input: SaveChapterToLocalInput): string {
  const { bookTitle, chapterNumber, chapterTitle, content, status, wordCount } = input

  const safeBookTitle = sanitizeFilename(bookTitle)
  const safeChapterTitle = sanitizeFilename(chapterTitle)
  const bookDir = path.join(LOCAL_NOVELS_DIR, safeBookTitle)
  ensureDir(bookDir)

  const filename = `第${chapterNumber}章-${safeChapterTitle}.md`
  const filepath = path.join(bookDir, filename)

  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const wordCountStr = wordCount ? `${wordCount}字` : '未知字数'
  const statusLabel = status === 'finalized' ? '终稿' : status === 'ai_draft' ? 'AI草稿' : status === 'edited' ? '人工编辑' : status

  const markdown = `# ${chapterTitle}\n\n> **状态**: ${statusLabel} | **字数**: ${wordCountStr} | **保存时间**: ${timestamp}\n\n---\n\n${content}\n`

  fs.writeFileSync(filepath, markdown, 'utf-8')
  return filepath
}

/**
 * 保存整本书的所有章节到本地（用于批量导出）
 */
export async function exportBookToLocal(bookId: string): Promise<{ dir: string; count: number }> {
  const { prisma } = await import('./db')

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      chapters: {
        orderBy: { chapterNumber: 'asc' },
      },
    },
  })

  if (!book) throw new Error(`Book not found: ${bookId}`)

  const safeBookTitle = sanitizeFilename(book.title)
  const bookDir = path.join(LOCAL_NOVELS_DIR, safeBookTitle)
  ensureDir(bookDir)

  let count = 0
  for (const chapter of book.chapters) {
    const content = chapter.finalContent || chapter.draftContent
    if (!content) continue

    saveChapterToLocal({
      bookTitle: book.title,
      chapterNumber: chapter.chapterNumber,
      chapterTitle: chapter.title,
      content,
      status: chapter.status,
      wordCount: chapter.wordCount,
    })
    count++
  }

  return { dir: bookDir, count }
}
