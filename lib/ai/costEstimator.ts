/**
 * 成本估算工具
 *
 * 基于输入内容长度和任务类型，预估 token 消耗和费用。
 * 中文字符按 1.5 tokens/字估算（保守估计）。
 */

const TOKEN_RATE = 1.5 // 中文字符 → tokens 估算系数
const COST_PER_1K_TOKENS = 0.012 // Kimi 8k 模型价格（元）

interface CostEstimate {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number // 元
}

function estimateTokens(text: string): number {
  // 简单估算：中文字符按 1.5 tokens，英文按 0.5 tokens
  let tokens = 0
  for (const char of text) {
    tokens += char.charCodeAt(0) > 127 ? TOKEN_RATE : 0.5
  }
  return Math.ceil(tokens)
}

/**
 * 估算设定生成成本
 */
export function estimateSettingCost(coreIdea: string): CostEstimate {
  const inputTokens = estimateTokens(coreIdea) + 500 // Prompt 模板 + system 提示
  const outputTokens = 500 // JSON 设定输出
  const totalTokens = inputTokens + outputTokens
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cost: Math.round((totalTokens / 1000) * COST_PER_1K_TOKENS * 1000) / 1000,
  }
}

/**
 * 估算人设生成成本
 */
export function estimateCharactersCost(storyBible: string): CostEstimate {
  const inputTokens = estimateTokens(storyBible) + 800
  const outputTokens = 1200 // 6个角色的 JSON
  const totalTokens = inputTokens + outputTokens
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cost: Math.round((totalTokens / 1000) * COST_PER_1K_TOKENS * 1000) / 1000,
  }
}

/**
 * 估算大纲生成成本
 */
export function estimateOutlineCost(storyBible: string, characterCount: number): CostEstimate {
  const inputTokens = estimateTokens(storyBible) + characterCount * 200 + 1000
  const outputTokens = 3000 // 大纲 JSON
  const totalTokens = inputTokens + outputTokens
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cost: Math.round((totalTokens / 1000) * COST_PER_1K_TOKENS * 1000) / 1000,
  }
}

/**
 * 估算写章节成本
 */
export function estimateWriteChapterCost(contextLength: number): CostEstimate {
  const inputTokens = contextLength + 1000 // 上下文 + Prompt
  const outputTokens = 4000 // 章节正文
  const totalTokens = inputTokens + outputTokens
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cost: Math.round((totalTokens / 1000) * COST_PER_1K_TOKENS * 1000) / 1000,
  }
}

/**
 * 格式化成本显示
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) return `${(cost * 1000).toFixed(1)} 厘`
  if (cost < 0.1) return `${(cost * 100).toFixed(1)} 分`
  if (cost < 1) return `${(cost * 10).toFixed(1)} 角`
  return `${cost.toFixed(2)} 元`
}

/**
 * 格式化 token 数
 */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`
  return `${(tokens / 1000).toFixed(1)}K`
}
