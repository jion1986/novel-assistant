/**
 * 多模型路由客户端
 *
 * 支持配置多个 AI 模型，按优先级自动降级。
 * 当主模型限流或失败时，自动切换到备用模型。
 */

import { config } from 'dotenv'
// 加载顺序：.env (基础配置) → .env.local (本地覆盖，允许覆盖已有变量)
config({ path: '.env', quiet: true })
config({ path: '.env.local', override: true, quiet: true })

export interface ModelCallOptions {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
  responseFormat?: { type: 'text' | 'json_object' }
  stream?: boolean
}

export interface StreamChunk {
  chunk: string
  done: boolean
  model: string
  provider: string
}

export interface ModelCallResult {
  content: string
  inputTokens: number
  outputTokens: number
  model: string
  provider: string
}

export interface ModelProvider {
  name: string
  baseUrl: string
  apiKey: string
  model: string
  enabled: boolean
}

interface ModelError {
  message: string
  code?: string
}

const MAX_RETRIES_PER_MODEL = 3
const TIMEOUT_MS = 60000

function loadProviders(): ModelProvider[] {
  const providers: ModelProvider[] = []

  // Primary: Kimi
  const kimiKey = process.env.KIMI_API_KEY
  if (kimiKey) {
    providers.push({
      name: 'kimi',
      baseUrl: process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
      apiKey: kimiKey,
      model: process.env.KIMI_MODEL || 'moonshot-v1-8k',
      enabled: true,
    })
  }

  // Backup 1
  const backup1Key = process.env.BACKUP_1_API_KEY
  if (backup1Key) {
    providers.push({
      name: 'backup-1',
      baseUrl: process.env.BACKUP_1_BASE_URL || '',
      apiKey: backup1Key,
      model: process.env.BACKUP_1_MODEL || '',
      enabled: true,
    })
  }

  // Backup 2
  const backup2Key = process.env.BACKUP_2_API_KEY
  if (backup2Key) {
    providers.push({
      name: 'backup-2',
      baseUrl: process.env.BACKUP_2_BASE_URL || '',
      apiKey: backup2Key,
      model: process.env.BACKUP_2_MODEL || '',
      enabled: true,
    })
  }

  return providers
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callSingleProvider(
  provider: ModelProvider,
  options: ModelCallOptions
): Promise<ModelCallResult> {
  const { messages, temperature = 0.7, maxTokens = 8000, responseFormat } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature,
        max_tokens: maxTokens,
        response_format: responseFormat,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorBody = await response.text()
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '5', 10)
        await sleep(retryAfter * 1000)
      }
      throw new Error(`API error: ${response.status} ${errorBody}`)
    }

    const data = await response.json()
    const choice = data.choices?.[0]

    if (!choice) {
      throw new Error('No completion choice returned')
    }

    return {
      content: choice.message?.content || '',
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
      model: data.model || provider.model,
      provider: provider.name,
    }
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * 调用 AI 模型，自动在多个提供商之间降级
 */
export async function callModel(options: ModelCallOptions): Promise<ModelCallResult> {
  const providers = loadProviders()

  if (providers.length === 0) {
    throw new Error('No AI model providers configured. Please set KIMI_API_KEY or backup model keys.')
  }

  const errors: Array<{ provider: string; error: ModelError }> = []

  for (const provider of providers) {
    if (!provider.enabled) continue

    for (let attempt = 1; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        const result = await callSingleProvider(provider, options)
        return result
      } catch (error) {
        const errorInfo: ModelError = {
          message: error instanceof Error ? error.message : String(error),
          code: error instanceof Error && 'code' in error ? (error as Error & { code: string }).code : undefined,
        }

        const isOverloaded =
          errorInfo.message.includes('429') ||
          errorInfo.message.includes('overloaded') ||
          errorInfo.message.includes('rate limit')

        if (attempt < MAX_RETRIES_PER_MODEL && isOverloaded) {
          const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 15000)
          await sleep(backoffMs)
          continue
        }

        errors.push({ provider: provider.name, error: errorInfo })
        break
      }
    }
  }

  // 所有模型都失败了
  const errorSummary = errors.map((e) => `${e.provider}: ${e.error.message}`).join('; ')
  throw new Error(`All model providers failed: ${errorSummary}`)
}

/**
 * 流式调用 AI 模型，返回 ReadableStream
 * 格式: data: {"chunk":"...","done":false}\n\n
 */
export async function callModelStream(options: ModelCallOptions): Promise<ReadableStream> {
  const providers = loadProviders()
  if (providers.length === 0) {
    throw new Error('No AI model providers configured.')
  }

  const { messages, temperature = 0.7, maxTokens = 8000 } = options
  const errors: Array<{ provider: string; error: string }> = []

  for (const provider of providers) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorBody = await response.text()
        errors.push({ provider: provider.name, error: `API error: ${response.status} ${errorBody}` })
        continue
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      const encoder = new TextEncoder()

      return new ReadableStream({
        async pull(streamController) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              streamController.enqueue(encoder.encode(`data: {"chunk":"","done":true,"model":"${provider.model}","provider":"${provider.name}"}\n\n`))
              streamController.close()
              return
            }

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (!line.trim() || !line.startsWith('data:')) continue
              const jsonStr = line.slice(5).trim()
              if (jsonStr === '[DONE]') {
                streamController.enqueue(encoder.encode(`data: {"chunk":"","done":true,"model":"${provider.model}","provider":"${provider.name}"}\n\n`))
                streamController.close()
                return
              }

              try {
                const parsed = JSON.parse(jsonStr)
                const delta = parsed.choices?.[0]?.delta?.content
                if (delta) {
                  const payload = JSON.stringify({
                    chunk: delta,
                    done: false,
                    model: provider.model,
                    provider: provider.name,
                  })
                  streamController.enqueue(encoder.encode(`data: ${payload}\n\n`))
                }
              } catch {
                // 忽略无法解析的行
              }
            }
          }
        },
        cancel() {
          reader.cancel()
        },
      })
    } catch (error) {
      clearTimeout(timeoutId)
      errors.push({
        provider: provider.name,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const errorSummary = errors.map((e) => `${e.provider}: ${e.error}`).join('; ')
  throw new Error(`All model providers failed: ${errorSummary}`)
}

/**
 * 获取当前可用的模型列表（用于 UI 显示）
 */
export function getAvailableModels(): Array<{ name: string; model: string; enabled: boolean }> {
  return loadProviders().map((p) => ({ name: p.name, model: p.model, enabled: p.enabled }))
}
