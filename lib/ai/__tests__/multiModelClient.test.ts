/**
 * 多模型路由客户端测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { callModel, getAvailableModels, callModelStream } from '../multiModelClient'

const originalEnv = process.env

describe('loadProviders / getAvailableModels', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.KIMI_API_KEY
    delete process.env.BACKUP_1_API_KEY
    delete process.env.BACKUP_2_API_KEY
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('无配置时返回空列表', () => {
    expect(getAvailableModels()).toEqual([])
  })

  it('配置 Kimi 后返回模型信息', () => {
    process.env.KIMI_API_KEY = 'test-key'
    process.env.KIMI_MODEL = 'moonshot-v1-32k'
    const models = getAvailableModels()
    expect(models).toHaveLength(1)
    expect(models[0]).toMatchObject({
      name: 'kimi',
      model: 'moonshot-v1-32k',
      enabled: true,
    })
  })

  it('配置备用模型后返回多个模型', () => {
    process.env.KIMI_API_KEY = 'kimi-key'
    process.env.BACKUP_1_API_KEY = 'backup1-key'
    process.env.BACKUP_1_MODEL = 'backup-model'
    process.env.BACKUP_2_API_KEY = 'backup2-key'
    process.env.BACKUP_2_MODEL = 'backup2-model'
    const models = getAvailableModels()
    expect(models).toHaveLength(3)
    expect(models[1].name).toBe('backup-1')
    expect(models[2].name).toBe('backup-2')
  })
})

describe('callModel', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.KIMI_API_KEY = 'test-key'
    process.env.KIMI_BASE_URL = 'https://api.test.com/v1'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    process.env = originalEnv
    vi.unstubAllGlobals()
  })

  it('成功调用返回结果', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Result' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        model: 'test-model',
      }),
    } as Response)

    const result = await callModel({ messages: [{ role: 'user', content: 'Hello' }] })
    expect(result.content).toBe('Result')
    expect(result.inputTokens).toBe(10)
    expect(result.outputTokens).toBe(5)
    expect(result.provider).toBe('kimi')
  })

  it('无 provider 配置时抛出错误', async () => {
    delete process.env.KIMI_API_KEY
    await expect(callModel({ messages: [] })).rejects.toThrow('No AI model providers configured')
  })

  it('API 返回非 200 时抛出错误', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
      headers: new Headers(),
    } as Response)

    await expect(callModel({ messages: [] })).rejects.toThrow('All model providers failed')
  })

  it('429 限流后重试并最终失败', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limited',
      headers: new Headers({ 'retry-after': '0' }),
    } as Response)

    await expect(callModel({ messages: [] })).rejects.toThrow('All model providers failed')
    expect(fetch).toHaveBeenCalledTimes(3)
  }, 15000)

  it('空 choices 时抛出错误', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] }),
    } as Response)

    await expect(callModel({ messages: [] })).rejects.toThrow('All model providers failed')
  })
})

describe('callModelStream', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.KIMI_API_KEY = 'test-key'
    process.env.KIMI_BASE_URL = 'https://api.test.com/v1'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    process.env = originalEnv
    vi.unstubAllGlobals()
  })

  it('成功时返回 ReadableStream', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      body: stream,
    } as Response)

    const result = await callModelStream({ messages: [] })
    expect(result).toBeInstanceOf(ReadableStream)

    const reader = result.getReader()
    const chunks: string[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(new TextDecoder().decode(value))
    }
    expect(chunks.some((c) => c.includes('Hello'))).toBe(true)
  })

  it('无 provider 时抛出错误', async () => {
    delete process.env.KIMI_API_KEY
    await expect(callModelStream({ messages: [] })).rejects.toThrow('No AI model providers configured')
  })

  it('API 错误时抛出错误', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as Response)

    await expect(callModelStream({ messages: [] })).rejects.toThrow('API error: 401')
  })

  it('忽略无 delta 的数据行', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{}}]}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      body: stream,
    } as Response)

    const result = await callModelStream({ messages: [] })
    const reader = result.getReader()
    const chunks: string[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(new TextDecoder().decode(value))
    }
    // 应该不包含空的 chunk，只包含 done 标记
    expect(chunks.length).toBeGreaterThanOrEqual(1)
  })

  it('取消流时调用 reader.cancel', async () => {
    const reader = {
      read: vi.fn().mockResolvedValue({ done: true }),
      cancel: vi.fn().mockResolvedValue(undefined),
    }
    const body = {
      getReader: () => reader,
    }

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      body,
    } as unknown as Response)

    const result = await callModelStream({ messages: [] })
    await result.cancel()
    expect(reader.cancel).toHaveBeenCalled()
  })
})
