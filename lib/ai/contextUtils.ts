export const TARGET_CHAPTER_WORDS = 3000
export const MIN_CHAPTER_WORDS = 2700
export const SOFT_MAX_CHAPTER_WORDS = 3300
export const HARD_MAX_CHAPTER_WORDS = 3900

export interface MemoryContextItem {
  type: string
  content: string
  importance?: string | null
  isLocked?: boolean | null
  relatedChapter?: string | null
  createdAt?: Date | string | null
}

export interface CharacterContextItem {
  name: string
  role?: string | null
  identity?: string | null
  personality?: string | null
  currentStatus?: string | null
  relationships?: string | null
  lockedFacts?: string | null
}

interface MemorySelectionOptions {
  chapterTitle?: string | null
  chapterGoal?: string | null
  chapterPlan?: string | null
  chapterContent?: string | null
  characters?: CharacterContextItem[]
  recentChapterIds?: string[]
  maxItems?: number
  maxChars?: number
}

export function countContentWords(content: string): number {
  return content.replace(/\s/g, '').length
}

export function limitText(value: string | null | undefined, maxChars: number): string {
  const clean = (value || '').replace(/\s+/g, ' ').trim()
  if (clean.length <= maxChars) return clean
  return `${clean.slice(0, Math.max(0, maxChars - 12)).trim()}……[已截断]`
}

export function estimatePromptTokens(content: string): number {
  return Math.round(content.length * 1.2)
}

export function formatCharactersForContext(characters: CharacterContextItem[], maxChars = 2600): string {
  const content =
    characters
      .map((c) =>
        [
          `${c.name}(${c.role || 'unknown'})`,
          `身份: ${c.identity || '无'}`,
          `性格: ${c.personality || '无'}`,
          `当前状态: ${c.currentStatus || '无状态'}`,
          `关系: ${c.relationships || '无'}`,
          `锁定事实: ${c.lockedFacts || '无'}`,
        ].join(' | ')
      )
      .join('\n') || '无'

  return limitText(content, maxChars)
}

export function trimChapterToWordLimit(content: string, maxWords = HARD_MAX_CHAPTER_WORDS): string {
  if (countContentWords(content) <= maxWords) return content

  let seen = 0
  let cutoff = content.length
  for (let i = 0; i < content.length; i++) {
    if (!/\s/.test(content[i])) seen++
    if (seen >= maxWords) {
      cutoff = i + 1
      break
    }
  }

  const nextSentenceEnd = content.slice(cutoff, cutoff + 180).search(/[。！？!?]\s*/)
  if (nextSentenceEnd >= 0) {
    return content.slice(0, cutoff + nextSentenceEnd + 1).trim()
  }

  const before = content.slice(0, cutoff)
  const lastSentenceEnd = Math.max(
    before.lastIndexOf('。'),
    before.lastIndexOf('！'),
    before.lastIndexOf('？'),
    before.lastIndexOf('!'),
    before.lastIndexOf('?')
  )
  if (lastSentenceEnd > 0 && countContentWords(before.slice(0, lastSentenceEnd + 1)) >= MIN_CHAPTER_WORDS) {
    return before.slice(0, lastSentenceEnd + 1).trim()
  }

  return before.trim()
}

function normalize(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase()
}

function importanceScore(value: string | null | undefined): number {
  if (value === 'critical') return 120
  if (value === 'high') return 80
  if (value === 'normal') return 35
  if (value === 'low') return 5
  return 20
}

function typeScore(value: string): number {
  if (value === 'rule') return 45
  if (value === 'character' || value === 'relationship') return 40
  if (value === 'event') return 25
  if (value === 'item' || value === 'location') return 15
  return 10
}

function extractSignals(options: MemorySelectionOptions): string[] {
  const values = [
    options.chapterTitle || '',
    options.chapterGoal || '',
    options.chapterPlan || '',
    limitText(options.chapterContent, 1200),
  ]
  const signals = new Set<string>()

  for (const character of options.characters || []) {
    if (character.name) signals.add(normalize(character.name))
  }

  const source = normalize(values.join(' '))
  const chineseRuns = source.match(/[\u4e00-\u9fff]{2,}/g) || []
  for (const run of chineseRuns) {
    if (run.length <= 8) {
      signals.add(run)
      continue
    }
    for (let i = 0; i < run.length - 1 && signals.size < 160; i++) {
      signals.add(run.slice(i, i + 2))
      if (i < run.length - 2) signals.add(run.slice(i, i + 3))
    }
  }

  for (const token of source.match(/[a-z0-9_]{2,}/g) || []) {
    signals.add(token)
  }

  return [...signals].filter((item) => item.length >= 2)
}

export function selectRelevantMemoryItems(
  memoryItems: MemoryContextItem[],
  options: MemorySelectionOptions = {}
): MemoryContextItem[] {
  const maxItems = options.maxItems ?? 24
  const signals = extractSignals(options)
  const recentChapterIds = new Set(options.recentChapterIds || [])

  const scored = memoryItems.map((item, index) => {
    const content = normalize(item.content)
    let score = importanceScore(item.importance) + typeScore(item.type)
    if (item.isLocked) score += 160
    if (item.relatedChapter && recentChapterIds.has(item.relatedChapter)) score += 80
    score += Math.max(0, 50 - index * 2)

    let matches = 0
    for (const signal of signals) {
      if (content.includes(signal)) matches++
      if (matches >= 20) break
    }
    score += matches * 12

    return { item, score }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems)
    .map((entry) => entry.item)
}

export function formatMemoryItemsForContext(
  memoryItems: MemoryContextItem[],
  options: MemorySelectionOptions = {}
): string {
  const maxChars = options.maxChars ?? 2400
  const selected = selectRelevantMemoryItems(memoryItems, options)
  const lines: string[] = []
  let used = 0

  for (const item of selected) {
    const line = `[${item.importance || 'normal'}][${item.type}] ${item.content}`
    if (used + line.length > maxChars) break
    lines.push(line)
    used += line.length
  }

  return lines.join('\n') || '无记忆'
}
