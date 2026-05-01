import { prisma } from '../db'
import { callKimi } from './kimiClient'
import { estimateCost } from './utils'
import { limitText } from './contextUtils'

export interface RewriteSelectionInput {
  bookId: string
  chapterId: string
  selectedText: string
  instruction: string
}

export interface RewriteSelectionResult {
  rewrittenText: string
  inputTokens: number
  outputTokens: number
  model: string
}

export function buildRewriteSelectionPrompt(input: {
  selectedText: string
  instruction: string
  storyBible: string
  characters: string
}): string {
  return [
    `改写要求：${input.instruction}`,
    '',
    `小说圣经：${limitText(input.storyBible, 1600)}`,
    `角色约束：${limitText(input.characters, 1600)}`,
    '',
    '需要改写的选中文本：',
    input.selectedText,
    '',
    '输出要求：',
    '- 只输出改写后的选中文本',
    '- 不要输出解释、标题、对比或修改说明',
    '- 不要改动未选中的上下文',
    '- 保持核心事实、人物关系和章节语气连续',
    '- 改写后长度与原文接近，除非用户明确要求扩写或精简',
  ].join('\n')
}

export async function rewriteSelection(input: RewriteSelectionInput): Promise<RewriteSelectionResult> {
  const selectedText = input.selectedText.trim()
  const instruction = input.instruction.trim()

  if (!selectedText) throw new Error('Selected text is required')
  if (!instruction) throw new Error('Rewrite instruction is required')

  const chapter = await prisma.chapter.findUnique({
    where: { id: input.chapterId },
    include: {
      book: {
        include: {
          storyBible: true,
          characters: { orderBy: { orderIndex: 'asc' } },
        },
      },
    },
  })
  if (!chapter || chapter.bookId !== input.bookId) throw new Error(`Chapter not found: ${input.chapterId}`)

  const characters = chapter.book.characters
    .map((c) => `${c.name}(${c.role}): ${c.currentStatus || c.personality || ''} [锁定设定: ${c.lockedFacts || '无'}]`)
    .join('\n')

  const callResult = await callKimi({
    messages: [
      {
        role: 'system',
        content: '你是小说编辑。你只改写用户选中的片段，保持原章节事实、人物关系和叙事语气连续。只输出改写后的片段。',
      },
      {
        role: 'user',
        content: buildRewriteSelectionPrompt({
          selectedText,
          instruction,
          storyBible: JSON.stringify(chapter.book.storyBible),
          characters,
        }),
      },
    ],
    temperature: 0.6,
    maxTokens: Math.min(2600, Math.max(700, Math.ceil(selectedText.length * 1.8))),
  })

  const rewrittenText = callResult.content.trim()
  if (!rewrittenText) throw new Error('Rewrite returned empty content')

  await prisma.generationRun.create({
    data: {
      bookId: input.bookId,
      chapterId: input.chapterId,
      taskType: 'rewrite_selection',
      inputTokens: callResult.inputTokens,
      outputTokens: callResult.outputTokens,
      model: callResult.model,
      result: 'success',
      costEstimate: estimateCost(callResult.inputTokens, callResult.outputTokens),
    },
  })

  return {
    rewrittenText,
    inputTokens: callResult.inputTokens,
    outputTokens: callResult.outputTokens,
    model: callResult.model,
  }
}
