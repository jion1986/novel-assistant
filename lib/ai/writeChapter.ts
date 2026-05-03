import { callKimi } from './kimiClient'
import { prisma } from '../db'
import { estimateCost } from './utils'
import { generateTempSummary } from './generateSummary'
import { buildWriteChapterContext } from './writeContext'
import { getGenrePrompt } from './genrePrompts'
import { polishChapter } from './polishChapter'
import { reviewConsistency } from './reviewConsistency'
import { saveChapterToLocal } from '../localExport'
import {
  HARD_MAX_CHAPTER_WORDS,
  MIN_CHAPTER_WORDS,
  SOFT_MAX_CHAPTER_WORDS,
  TARGET_CHAPTER_WORDS,
  countContentWords,
  trimChapterToWordLimit,
} from './contextUtils'
import type { Chapter } from '@prisma/client'

export interface WriteChapterInput {
  bookId: string
  chapterId: string
}

export interface WriteChapterResult {
  chapter: Chapter
}

/**
 * 生成章节正文
 */
export async function writeChapter(input: WriteChapterInput): Promise<WriteChapterResult> {
  const { bookId, chapterId } = input

  const { prompt } = await buildWriteChapterContext({ bookId, chapterId })

  // 获取书籍信息（题材、角色等）
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      characters: { orderBy: { orderIndex: 'asc' } },
    },
  })
  const genrePrompt = getGenrePrompt(book?.genre)

  const systemPrompt = `你是一位顶尖的网络小说写手，日更过万、擅长多题材。你深知中国网文读者的痛点：节奏拖沓、对话水、描写空泛、AI味重。你的写作风格是——信息密度高、情绪节奏快、细节有画面感、对话有个性。

写作时必须严格遵守以下约束（违反任何一条都会让读者出戏）：
1. 绝对禁止用"深吸一口气""他知道/明白/意识到""眼神坚定/目光坚毅""战斗激烈而短暂/经过一番激战/战斗异常激烈/战斗即将来临/战斗爆发了/最终被击退"等套路句式表达情绪或认知。认知必须通过行动和细节表现，情绪必须通过身体反应和环境反射表现。
2. 战斗必须写具体动作链（谁做了什么→身体哪个部位动了→造成了什么后果→对方如何反应），禁止用总结性词语一笔带过。
3. 对话必须有打断和个性：禁止连续3句以上纯对话，每2句后必须有动作描写、环境变化或第三方反应插入。
4. 每个场景必须有至少一个具体的、可触摸的锚点物件参与叙事（如"磨破皮的转椅扶手""裂了一条缝的键盘"），禁止用"空气仿佛凝固了"等无实体描写。
5. 平铺直述的心理描写是禁区——不要写"他知道…""他意识到…"，要写成"陈默说话时眼珠往右上方飘了一下——和每次撒谎时一样"。
6. 角色绝对锁定：本章只能使用用户提供的角色列表中的人物。禁止引入任何未列出的新角色，禁止给已有角色添加列表中没有的设定（如新增亲属、职业、能力）。如果列表中没有"赵铁柱"，文中就不能出现这个名字。每个角色的性格、说话风格和当前状态必须与列表一致，不能突然改变。

${genrePrompt}

请写出节奏紧凑、人物鲜活的章节正文。严格控制在目标字数区间内，达到区间后立即收束，不要输出章节标题。`

  let fullContent = ''
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let finalModel = ''
  let compressAttempts = 0

  // 第一次生成
  const firstResult = await callKimi({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature: 0.85,
    maxTokens: 4200,
  })

  fullContent = firstResult.content
  totalInputTokens += firstResult.inputTokens
  totalOutputTokens += firstResult.outputTokens
  finalModel = firstResult.model

  // 字数检查与续写
  let currentWordCount = countContentWords(fullContent)
  let attempts = 0
  const maxAttempts = 2

  while (currentWordCount < MIN_CHAPTER_WORDS && attempts < maxAttempts) {
    attempts++
    const remainingWords = Math.min(TARGET_CHAPTER_WORDS - currentWordCount, SOFT_MAX_CHAPTER_WORDS - currentWordCount)

    const continuePrompt = `你正在写的这一章字数不足。当前已写 ${currentWordCount} 字，目标区间 ${MIN_CHAPTER_WORDS}-${SOFT_MAX_CHAPTER_WORDS} 字，还需要续写约 ${remainingWords} 字。

续写要求：
- 绝对不要重复已经写过的内容
- 续写部分必须带来新的信息增量（新发现、新阻碍、新揭示或新关系）
- 不要只是"展开描写"，要推进剧情或增加新的冲突层
- 续写后整章不要超过 ${SOFT_MAX_CHAPTER_WORDS} 字；达到目标区间后立刻收束，用结尾钩子结束
- 绝对禁止套路句式："深吸一口气""他知道/明白/意识到""眼神坚定/目光坚毅""战斗异常激烈/战斗即将来临/战斗爆发了/最终被击退"（认知必须通过行动和细节表现，禁止直接叙述）
- 角色绝对锁定：只能使用用户提供的角色列表中的人物，禁止引入新角色或给已有角色添加未列出的设定
- 每个场景必须有具体的锚点物件参与叙事
- 对话禁止连续3句以上无打断

当前已写内容的最后一段：
"""
${fullContent.slice(-500)}
"""

请继续写后续内容，直接输出续写部分（不要重复前文）。需要续写约 ${remainingWords} 字。`

    const continueResult = await callKimi({
      messages: [
        { role: 'system', content: `你是一位顶尖的网络小说写手。请直接输出续写部分，不要重复前文，严格控制新增字数。

续写时必须遵守以下约束（这些约束与首次生成完全一致，不可放松）：
1. 绝对禁止"深吸一口气""他知道/明白/意识到""眼神坚定""战斗激烈而短暂/经过一番激战/战斗异常激烈/战斗即将来临/战斗爆发了/最终被击退"等套路句式。
2. 认知必须通过行动和细节表现，禁止直接叙述心理活动。
3. 对话禁止连续3句以上无打断，必须有动作/环境/反应插入。
4. 每个场景必须有具体的锚点物件参与叙事。
5. 战斗必须写具体动作链，禁止总结性词语。
6. 角色绝对锁定：只能使用用户提供的角色列表中的人物，禁止引入新角色或给已有角色添加未列出的设定。` },
        { role: 'user', content: continuePrompt },
      ],
      temperature: 0.85,
      maxTokens: Math.min(2400, Math.max(900, Math.ceil(remainingWords * 1.4))),
    })

    fullContent += '\n' + continueResult.content
    totalInputTokens += continueResult.inputTokens
    totalOutputTokens += continueResult.outputTokens

    const newCount = countContentWords(fullContent)
    console.log(`  续写 #${attempts}: ${currentWordCount} → ${newCount} 字`)

    if (newCount <= currentWordCount) break // 没有新增内容，停止
    currentWordCount = newCount
  }

  if (currentWordCount > HARD_MAX_CHAPTER_WORDS) {
    compressAttempts++
    const contentBeforeCompression = fullContent
    const wordCountBeforeCompression = currentWordCount
    const compressResult = await callKimi({
      messages: [
        {
          role: 'system',
          content: '你是小说编辑。请在不改变剧情事实、人物关系和结尾钩子的前提下压缩章节。只输出压缩后的正文，不要解释。',
        },
        {
          role: 'user',
          content: `下面这一章过长，当前约 ${currentWordCount} 字。请压缩到 ${MIN_CHAPTER_WORDS}-${SOFT_MAX_CHAPTER_WORDS} 字，保留关键事件、人物行动、冲突升级和结尾钩子，删掉重复描写和空泛心理描写。\n\n${fullContent}`,
        },
      ],
      temperature: 0.45,
      maxTokens: 4200,
    })

    totalInputTokens += compressResult.inputTokens
    totalOutputTokens += compressResult.outputTokens
    finalModel = `${finalModel} -> ${compressResult.model}`
    const compressedContent = compressResult.content
    const compressedContentWordCount = countContentWords(compressedContent)

    if (
      compressedContentWordCount >= MIN_CHAPTER_WORDS &&
      compressedContentWordCount < wordCountBeforeCompression
    ) {
      fullContent = compressedContent
      currentWordCount = compressedContentWordCount
      console.log(`  压缩 #${compressAttempts}: ${wordCountBeforeCompression} → ${currentWordCount} 字`)
    } else {
      fullContent = contentBeforeCompression
      currentWordCount = wordCountBeforeCompression
      console.log(`  压缩 #${compressAttempts} 未采用: ${wordCountBeforeCompression} → ${compressedContentWordCount} 字`)
    }
  }

  if (currentWordCount > HARD_MAX_CHAPTER_WORDS) {
    const trimmed = trimChapterToWordLimit(fullContent, HARD_MAX_CHAPTER_WORDS)
    const trimmedWordCount = countContentWords(trimmed)
    if (trimmedWordCount >= MIN_CHAPTER_WORDS && trimmedWordCount < currentWordCount) {
      console.log(`  硬截断: ${currentWordCount} → ${trimmedWordCount} 字`)
      fullContent = trimmed
      currentWordCount = trimmedWordCount
    }
  }

  // P4: 反AI味润色（检测套路句式并改写）
  const polishResult = await polishChapter(fullContent)
  if (polishResult.issuesFound > 0) {
    if (polishResult.issuesFixed > 0) {
      console.log(`  润色: 发现 ${polishResult.issuesFound} 处套路句式，已修复 ${polishResult.issuesFixed} 处`)
      fullContent = polishResult.content
      currentWordCount = countContentWords(fullContent)
    } else {
      console.log(`  润色: 发现 ${polishResult.issuesFound} 处套路句式，未修复（保留原文）`)
    }
    totalInputTokens += polishResult.inputTokens
    totalOutputTokens += polishResult.outputTokens
  }

  // P3: 设定一致性审查
  const prevChapter = await prisma.chapter.findFirst({
    where: { bookId, chapterNumber: { lt: (await prisma.chapter.findUnique({ where: { id: chapterId } }))?.chapterNumber || 0 } },
    orderBy: { chapterNumber: 'desc' },
    select: { summary: true },
  })

  const reviewResult = await reviewConsistency({
    content: fullContent,
    characters: book?.characters || [],
    genre: book?.genre,
    previousSummary: prevChapter?.summary,
    chapterTitle: (await prisma.chapter.findUnique({ where: { id: chapterId } }))?.title || '',
  })

  if (!reviewResult.passed) {
    const highIssues = reviewResult.issues.filter((i) => i.severity === 'high')
    const medIssues = reviewResult.issues.filter((i) => i.severity === 'medium')
    console.log(`  审查: ${highIssues.length} 个严重问题, ${medIssues.length} 个中等问题`)
    for (const issue of reviewResult.issues.slice(0, 5)) {
      console.log(`    [${issue.severity}] ${issue.type}: ${issue.description}`)
    }
  } else {
    console.log(`  审查: 通过`)
  }

  // 生成临时摘要（确保后续章节有前文参考）
  const tempSummary = generateTempSummary(fullContent)

  // 保存草稿
  const updatedChapter = await prisma.chapter.update({
    where: { id: chapterId },
    data: {
      draftContent: fullContent,
      status: 'ai_draft',
      wordCount: countContentWords(fullContent),
      summary: tempSummary,
    },
  })

  // 创建版本记录
  await prisma.chapterVersion.create({
    data: {
      chapterId,
      versionType: 'ai_draft',
      content: fullContent,
      note: `AI 生成，模型: ${finalModel || firstResult.model}${attempts > 0 ? ` (续写${attempts}次)` : ''}${compressAttempts > 0 ? ` (压缩${compressAttempts}次)` : ''}`,
    },
  })

  await prisma.generationRun.create({
    data: {
      bookId,
      chapterId,
      taskType: 'write',
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      model: finalModel || firstResult.model,
      result: 'success',
      costEstimate: estimateCost(totalInputTokens, totalOutputTokens),
    },
  })

  // 自动保存到本地
  const chapterWithBook = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: { book: { select: { title: true } } },
  })
  if (chapterWithBook && chapterWithBook.book) {
    const localPath = saveChapterToLocal({
      bookTitle: chapterWithBook.book.title,
      chapterNumber: chapterWithBook.chapterNumber,
      chapterTitle: chapterWithBook.title,
      content: fullContent,
      status: 'ai_draft',
      wordCount: currentWordCount,
    })
    console.log(`  已保存到本地: ${localPath}`)
  }

  return { chapter: updatedChapter }
}
