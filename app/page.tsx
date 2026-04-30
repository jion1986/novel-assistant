import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'

export default async function HomePage() {
  const session = await readSession()
  if (!session.isLoggedIn) {
    redirect('/login')
  }

  const books = await prisma.book.findMany({
    where: { userId: session.userId },
    orderBy: { updatedAt: 'desc' },
  })

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">AI 小说助手</h1>
        <Link
          href="/books/new"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          新建小说
        </Link>
      </div>

      {books.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          <p>暂无小说项目</p>
          <p className="mt-2 text-sm">点击上方按钮创建你的第一本小说</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map((book) => (
            <Link
              key={book.id}
              href={`/books/${book.id}`}
              className="block rounded-lg border bg-card p-5 hover:bg-accent transition-colors"
            >
              <h2 className="font-semibold text-lg mb-1">{book.title}</h2>
              <p className="text-sm text-muted-foreground mb-2">{book.genre}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{book.coreIdea}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  {book.status === 'active' ? '进行中' : book.status === 'completed' ? '已完成' : '已归档'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
