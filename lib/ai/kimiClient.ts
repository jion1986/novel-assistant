/**
 * Kimi API 客户端（兼容层）
 *
 * 所有 AI 调用通过此文件入口，实际路由到 multiModelClient。
 * 保留此文件以兼容现有调用方，无需修改各生成模块。
 */

import { callModel, type ModelCallOptions } from './multiModelClient'

export interface KimiCallOptions {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
  responseFormat?: { type: 'text' | 'json_object' }
}

export interface KimiCallResult {
  content: string
  inputTokens: number
  outputTokens: number
  model: string
}

export interface KimiError {
  message: string
  code?: string
}

export async function callKimi(options: KimiCallOptions): Promise<KimiCallResult> {
  const result = await callModel(options as ModelCallOptions)
  return {
    content: result.content,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    model: result.model,
  }
}
