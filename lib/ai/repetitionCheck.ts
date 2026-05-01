import type { ConsistencyIssue } from './checkConsistency'

export interface RepetitionChapterInput {
  chapterNumber: number
  title: string
  content: string
}

interface RepetitionAnalysis {
  issues: ConsistencyIssue[]
  openingSignals: string[]
}

const COMMON_SIGNALS = [
  '控制台',
  '控制面板',
  '屏幕',
  '数据',
  '数据流',
  '仪器',
  '警报',
  '能量场',
  '波动',
  '光芒',
  '手指',
  '指尖',
  '凝视',
  '注视',
  '站在',
  '心跳',
  '呼吸',
  '紧张',
  '沉默',
  '空气',
  '黑暗',
  '光影',
]

const STOP_PHRASES = new Set([
  '一个',
  '他们',
  '我们',
  '自己',
  '这个',
  '那个',
  '正在',
  '已经',
  '没有',
  '不是',
  '因为',
  '如果',
  '但是',
  '时候',
  '之中',
  '之间',
  '似乎',
])

function normalizeText(value: string): string {
  return value.replace(/\s+/g, '').replace(/[“”"'.,，。！？!?、：:；;《》【】（）()]/g, '').toLowerCase()
}

function openingOf(content: string, maxChars = 220): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, maxChars)
}

function ngrams(value: string, size: number): Set<string> {
  const normalized = normalizeText(value)
  const result = new Set<string>()
  for (let index = 0; index <= normalized.length - size; index++) {
    const gram = normalized.slice(index, index + size)
    if (!STOP_PHRASES.has(gram)) result.add(gram)
  }
  return result
}

function diceSimilarity(a: string, b: string): number {
  const aGrams = ngrams(a, 3)
  const bGrams = ngrams(b, 3)
  if (aGrams.size === 0 || bGrams.size === 0) return 0

  let intersection = 0
  for (const gram of aGrams) {
    if (bGrams.has(gram)) intersection++
  }

  return (2 * intersection) / (aGrams.size + bGrams.size)
}

function commonSignalHits(content: string): string[] {
  return COMMON_SIGNALS.filter((signal) => content.includes(signal))
}

function repeatedPhraseHits(content: string): string[] {
  const normalized = normalizeText(content)
  const counts = new Map<string, number>()
  const weakConnectives = ['和', '与', '以及', '还有', '他们', '我们', '一个']

  for (const size of [4, 5, 6]) {
    for (let index = 0; index <= normalized.length - size; index++) {
      const phrase = normalized.slice(index, index + size)
      if (!/[\u4e00-\u9fff]{4,}/.test(phrase)) continue
      if (/^[的着了和与一]/.test(phrase) || /[的一着在了和与]$/.test(phrase)) continue
      if ([...STOP_PHRASES].some((stop) => phrase.includes(stop))) continue
      if (weakConnectives.some((word) => phrase.includes(word))) continue
      if (!COMMON_SIGNALS.some((signal) => phrase.includes(signal))) continue
      counts.set(phrase, (counts.get(phrase) || 0) + 1)
    }
  }

  const selected: Array<[string, number]> = []
  for (const entry of [...counts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[0].length - a[0].length || b[1] - a[1])) {
    const [phrase] = entry
    if (selected.some(([existing]) => existing.includes(phrase) || phrase.includes(existing))) continue
    selected.push(entry)
    if (selected.length >= 5) break
  }

  return selected.map(([phrase, count]) => `${phrase} x${count}`)
}

export function buildOpeningAvoidanceNote(previousChapters: RepetitionChapterInput[]): string {
  const recent = previousChapters.slice(-3)
  const signalCounts = new Map<string, number>()

  for (const chapter of recent) {
    for (const signal of commonSignalHits(openingOf(chapter.content))) {
      signalCounts.set(signal, (signalCounts.get(signal) || 0) + 1)
    }
  }

  const repeatedSignals = [...signalCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([signal]) => signal)

  if (repeatedSignals.length === 0) {
    return '最近章节开头未发现高频重复意象，但本章仍需换一个新的冲突入口。'
  }

  return [
    `最近章节开头高频出现：${repeatedSignals.join('、')}。`,
    '本章开头必须避开这些动作和意象，优先从人物选择、外部阻碍、对话冲突或具体异常事件切入。',
  ].join('')
}

export function analyzeChapterRepetition(
  current: RepetitionChapterInput,
  previousChapters: RepetitionChapterInput[]
): RepetitionAnalysis {
  const issues: ConsistencyIssue[] = []
  const currentOpening = openingOf(current.content)
  const currentSignals = commonSignalHits(currentOpening)
  const previousRecent = previousChapters.filter((item) => item.chapterNumber < current.chapterNumber).slice(-5)

  let mostSimilar: { chapter: RepetitionChapterInput; similarity: number; sharedSignals: string[] } | null = null
  for (const previous of previousRecent) {
    const previousOpening = openingOf(previous.content)
    const similarity = diceSimilarity(currentOpening, previousOpening)
    const previousSignals = commonSignalHits(previousOpening)
    const sharedSignals = currentSignals.filter((signal) => previousSignals.includes(signal))
    if (!mostSimilar || similarity + sharedSignals.length * 0.03 > mostSimilar.similarity + mostSimilar.sharedSignals.length * 0.03) {
      mostSimilar = { chapter: previous, similarity, sharedSignals }
    }
  }

  if (mostSimilar && (mostSimilar.similarity >= 0.18 || mostSimilar.sharedSignals.length >= 3)) {
    issues.push({
      severity: mostSimilar.similarity >= 0.26 || mostSimilar.sharedSignals.length >= 5 ? 'medium' : 'low',
      type: 'repetition',
      description: `本章开头与第${mostSimilar.chapter.chapterNumber}章《${mostSimilar.chapter.title}》存在重复感，重复意象包括：${mostSimilar.sharedSignals.join('、') || '句式/动作结构相近'}。`,
      location: currentOpening,
      suggestion: '改写本章开头，避开相同的站位、手部动作、屏幕/数据/能量波动等入口，改用人物决策、外部阻碍或新的具体异常切入。',
    })
  }

  const repeatedPhrases = repeatedPhraseHits(current.content)
  if (repeatedPhrases.length > 0) {
    issues.push({
      severity: 'low',
      type: 'repetition',
      description: `本章内部存在重复短语：${repeatedPhrases.join('；')}。`,
      location: repeatedPhrases.slice(0, 3).join('；'),
      suggestion: '合并或改写重复表达，保留推进剧情的信息，删掉重复心理描写、仪器读数或环境描述。',
    })
  }

  return {
    issues,
    openingSignals: currentSignals,
  }
}
