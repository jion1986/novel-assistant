import { callKimi } from './kimiClient'
import { prisma } from '../db'
import { estimateCost } from './utils'
import { generateTempSummary } from './generateSummary'
import { buildWriteChapterContext } from './writeContext'
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

  let fullContent = ''
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let finalModel = ''
  let compressAttempts = 0

  // 第一次生成
  const firstResult = await callKimi({
    messages: [
      { role: 'system', content: '你是一位顶尖的网络小说写手，日更过万、擅长多题材。你深知中国网文读者的痛点：节奏拖沓、对话水、描写空泛、AI味重。你的写作风格是——信息密度高、情绪节奏快、细节有画面感、对话有个性。特别注意：绝对禁止套路句式（如"深吸一口气""他知道""战斗激烈而短暂""眼神坚定"），战斗必须写具体动作链而非总结，对话必须有打断和个性且禁止连续3句纯对话，每个场景要有可触摸的锚点物件，认知必须通过行动表现而非直接叙述。请写出节奏紧凑、人物鲜活的章节正文。严格控制在目标字数区间内，达到区间后立即收束，不要输出章节标题。' },
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

当前已写内容的最后一段：
"""
${fullContent.slice(-500)}
"""

请继续写后续内容，直接输出续写部分（不要重复前文）。需要续写约 ${remainingWords} 字。`

    const continueResult = await callKimi({
      messages: [
        { role: 'system', content: '你是一个专业的小说写手。请直接输出续写部分，不要重复前文，严格控制新增字数。' },
        { role: 'user', content: continuePrompt },
      ],
      temperature: 0.75,
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

  return { chapter: updatedChapter }
}
