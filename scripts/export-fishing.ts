import { prisma } from '../lib/db'
import fs from 'fs'

async function main() {
  const book = await prisma.book.findFirst({
    where: { title: '悠闲钓手' },
    include: {
      chapters: { orderBy: { chapterNumber: 'asc' } },
      storyBible: true,
      characters: true,
    },
  })
  if (!book) { console.log('No book'); return }

  let out = '# ' + book.title + '\n\n'
  out += '## 设定\n\n' + (book.storyBible?.worldSetting || '') + '\n\n'
  out += '## 核心冲突\n\n' + (book.storyBible?.coreConflict || '') + '\n\n'
  out += '## 力量体系\n\n' + (book.storyBible?.powerSystem || '') + '\n\n'
  out += '## 角色\n\n'
  for (const c of book.characters) {
    out += '- **' + c.name + '**: ' + (c.personality || '') + '\n'
  }
  out += '\n## 章节\n'
  for (const ch of book.chapters.slice(0, 3)) {
    out += '\n---\n\n## 第' + ch.chapterNumber + '章 ' + ch.title + '\n\n'
    out += (ch.finalContent || '') + '\n'
  }
  fs.writeFileSync('test-output/钓鱼文测试.md', out)
  console.log('Saved, size:', out.length)
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })
