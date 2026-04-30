import { readFile } from 'fs/promises'
import { join } from 'path'

/**
 * 读取 Prompt 模板文件
 */
export async function loadPromptTemplate(filename: string): Promise<string> {
  const path = join(process.cwd(), 'lib', 'ai', 'prompts', filename)
  return readFile(path, 'utf-8')
}

/**
 * 替换模板变量 {{key}} → value
 */
export function fillTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '')
}

/**
 * 解析 Kimi 返回的 JSON 内容
 *
 * Kimi 有时会返回带 markdown 代码块的 JSON，需要清洗
 */
export function parseJsonResponse<T>(content: string): T {
  let cleaned = content.trim()

  // 去掉 markdown 代码块标记
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }

  cleaned = cleaned.trim()

  try {
    return JSON.parse(cleaned) as T
  } catch (error) {
    throw new Error(
      `Failed to parse Kimi response as JSON: ${error instanceof Error ? error.message : String(error)}. Raw content: ${content.slice(0, 500)}`
    )
  }
}

/**
 * 计算预估成本（Kimi 8k 模型：0.012元/1K tokens）
 */
export function estimateCost(inputTokens: number, outputTokens: number): number {
  return ((inputTokens + outputTokens) / 1000) * 0.012
}
