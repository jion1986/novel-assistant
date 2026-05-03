import { callKimi } from './kimiClient'
import type { Character } from '@prisma/client'

export interface ConsistencyIssue {
  type: 'character_name' | 'setting_conflict' | 'genre_mismatch' | 'repetition' | 'logic_gap'
  description: string
  severity: 'high' | 'medium' | 'low'
  location?: string
  suggestion?: string
}

export interface ReviewResult {
  passed: boolean
  issues: ConsistencyIssue[]
  model: string
  inputTokens: number
  outputTokens: number
}

interface ReviewInput {
  content: string
  characters: Character[]
  genre?: string | null
  previousSummary?: string | null
  chapterTitle: string
}

/**
 * 规则检查：角色名一致性
 */
function checkCharacterNames(content: string, characters: Character[]): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = []
  const characterNames = new Set(characters.map((c) => c.name).filter(Boolean))

  // 排除常见代词和非人名词汇
  const EXCLUDED_WORDS = new Set([
    '他', '她', '它', '这', '那', '我', '你', '我们', '你们', '他们', '她们',
    '这个', '那个', '这里', '那里', '最终', '低声', '其实', '没有', '已经',
    '开始', '准备', '决定', '知道', '看到', '听到', '想到', '说到', '问道',
    '答道', '笑道', '喊道', '叫道', '劝道', '低声道', '大声道', '轻声道',
    '突然', '然后', '接着', '于是', '但是', '不过', '虽然', '因为', '所以',
    '只是', '只能', '必须', '不要', '不能', '不会', '可能', '应该',
  ])

  // 提取文中出现的所有人名（2-4字 + 说/道/问/答等动词，排除常见代词）
  const nameMatches = content.matchAll(/([一-龥]{2,4})(?:说|道|问|答|想|看|笑|喊|叫|劝)/g)
  const foundNames = new Set<string>()
  for (const match of nameMatches) {
    const name = match[1]
    if (!EXCLUDED_WORDS.has(name) && !EXCLUDED_WORDS.has(name.slice(0, 2))) {
      foundNames.add(name)
    }
  }

  for (const name of foundNames) {
    if (!characterNames.has(name) && name.length >= 2) {
      issues.push({
        type: 'character_name',
        description: `文中出现了未在角色列表中定义的人物"${name}"`,
        severity: 'high',
        suggestion: '删除该人物，或替换为角色列表中的已有角色',
      })
    }
  }

  return issues
}

/**
 * 规则检查：时代背景一致性
 */
function checkSettingConsistency(content: string, genre?: string | null): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = []

  // 种田文/古代背景检查
  if (genre && (genre.includes('种田') || genre.includes('古代') || genre.includes('重生'))) {
    const modernTerms = ['生态学家', '专家', '科学家', '先进知识', '技术', '科学', '手机', '电脑', '网络', '互联网']
    for (const term of modernTerms) {
      if (content.includes(term)) {
        issues.push({
          type: 'setting_conflict',
          description: `古代/种田背景中出现了现代词汇"${term}"`,
          severity: 'high',
          suggestion: '替换为古代对应词汇，或改为具体行为描写',
        })
      }
    }
  }

  // 都市背景检查
  if (genre && (genre.includes('都市') || genre.includes('现代'))) {
    const ancientTerms = ['马贼', '村长', '旱灾', '皇帝', '朝廷', '武林', '江湖']
    for (const term of ancientTerms) {
      if (content.includes(term)) {
        issues.push({
          type: 'setting_conflict',
          description: `都市/现代背景中出现了古代词汇"${term}"`,
          severity: 'high',
          suggestion: '替换为现代对应词汇',
        })
      }
    }
  }

  return issues
}

/**
 * 规则检查：重复桥段检测
 */
function checkRepetition(content: string, previousSummary?: string | null): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = []

  if (!previousSummary) return issues

  // 检查本章是否与上一章有相同的核心动作
  const repetitionPatterns = [
    { regex: /进入副本|进入裂隙|被吸入|被拉入/g, desc: '进入副本/裂隙' },
    { regex: /战斗爆发|战斗开始|打了起来/g, desc: '战斗爆发' },
    { regex: /陈默.*微笑|陈默.*冷笑|陈默.*游戏/g, desc: '陈默反派模板' },
    { regex: /这只是开始|游戏才刚刚开始|真正的考验/g, desc: '"这只是开始"式结尾' },
  ]

  for (const p of repetitionPatterns) {
    const currentMatches = content.match(p.regex)
    const prevMatches = previousSummary.match(p.regex)
    if (currentMatches && prevMatches) {
      issues.push({
        type: 'repetition',
        description: `本章与上一章重复了"${p.desc}"桥段`,
        severity: 'medium',
        suggestion: '换一种冲突启动方式，避免连续两章使用相同结构',
      })
    }
  }

  return issues
}

/**
 * AI 审查：深度一致性检查
 */
async function aiReview(input: ReviewInput): Promise<{ issues: ConsistencyIssue[]; model: string; inputTokens: number; outputTokens: number }> {
  const characterList = input.characters.map((c) => `${c.name}(${c.role})`).join(', ')

  const reviewPrompt = `请审查以下小说章节的一致性，找出设定冲突、逻辑漏洞和重复问题。

审查维度：
1. 角色一致性：是否有角色行为与设定矛盾？是否有新角色突然出现？
2. 设定一致性：世界观/规则/时代背景是否自洽？
3. 逻辑一致性：事件因果关系是否合理？是否有"赢了但什么都没失去"的情况？
4. 重复检测：是否与上一章有重复的结构或桥段？

角色列表（禁止引入名单外角色）：${characterList}
题材：${input.genre || '未指定'}
上一章摘要：${input.previousSummary || '无'}
本章标题：${input.chapterTitle}

重要：只报告确实有问题的内容。不要过度敏感。以下情况不算问题：
- 正常对话中出现的"他说/她道"等说话标记
- 主角的合理内心活动
- 与上一章有自然衔接但不是重复桥段
- 战斗场景中的正常动作描写

请按以下格式输出问题（如果没有则输出"通过"）：
类型: [character_name/setting_conflict/logic_gap/repetition]
严重程度: [high/medium/low]
问题: [具体描述]
建议: [修改方案]

---

${input.content.slice(0, 3000)}`

  const result = await callKimi({
    messages: [
      {
        role: 'system',
        content: '你是小说设定审查员，专门检查设定一致性、逻辑漏洞和重复问题。你输出结构化的问题列表。',
      },
      { role: 'user', content: reviewPrompt },
    ],
    temperature: 0.3,
    maxTokens: 2000,
  })

  // 解析 AI 输出
  const issues = parseAIReview(result.content)

  return {
    issues,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  }
}

function parseAIReview(content: string): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = []
  const blocks = content.split(/\n(?=类型:)/)

  for (const block of blocks) {
    const typeMatch = block.match(/类型:\s*(\w+)/)
    const severityMatch = block.match(/严重程度:\s*(\w+)/)
    const descMatch = block.match(/问题:\s*(.+?)(?:\n|$)/)
    const suggestionMatch = block.match(/建议:\s*(.+?)(?:\n|$)/)

    if (typeMatch && descMatch) {
      issues.push({
        type: typeMatch[1] as ConsistencyIssue['type'],
        description: descMatch[1].trim(),
        severity: (severityMatch?.[1] as ConsistencyIssue['severity']) || 'medium',
        suggestion: suggestionMatch?.[1]?.trim(),
      })
    }
  }

  return issues
}

/**
 * 设定一致性审查：规则检查 + AI 深度审查
 */
export async function reviewConsistency(input: ReviewInput): Promise<ReviewResult> {
  // 规则检查（快速、确定性）
  const ruleIssues: ConsistencyIssue[] = [
    ...checkCharacterNames(input.content, input.characters),
    ...checkSettingConsistency(input.content, input.genre),
    ...checkRepetition(input.content, input.previousSummary),
  ]

  // AI 深度审查（成本较高，只在规则检查通过时进行）
  let aiIssues: ConsistencyIssue[] = []
  let aiModel = 'none'
  let aiInputTokens = 0
  let aiOutputTokens = 0

  if (ruleIssues.length <= 2) {
    try {
      const aiResult = await aiReview(input)
      aiIssues = aiResult.issues
      aiModel = aiResult.model
      aiInputTokens = aiResult.inputTokens
      aiOutputTokens = aiResult.outputTokens
    } catch (error) {
      console.error('AI 审查失败:', error)
    }
  }

  const allIssues = [...ruleIssues, ...aiIssues]

  // 去重
  const seen = new Set<string>()
  const uniqueIssues = allIssues.filter((issue) => {
    const key = `${issue.type}:${issue.description}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return {
    passed: uniqueIssues.length === 0,
    issues: uniqueIssues,
    model: aiModel,
    inputTokens: aiInputTokens,
    outputTokens: aiOutputTokens,
  }
}
