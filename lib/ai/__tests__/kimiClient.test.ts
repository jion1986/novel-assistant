/**
 * Kimi 客户端兼容层测试
 */

import { describe, it, expect, vi } from 'vitest'
import { callKimi } from '../kimiClient'
import * as multiModelClient from '../multiModelClient'

vi.mock('../multiModelClient', () => ({
  callModel: vi.fn(),
}))

describe('callKimi', () => {
  it('调用 callModel 并转换结果格式', async () => {
    vi.mocked(multiModelClient.callModel).mockResolvedValue({
      content: 'Hello',
      inputTokens: 10,
      outputTokens: 5,
      model: 'moonshot-v1-8k',
      provider: 'kimi',
    })

    const result = await callKimi({
      messages: [{ role: 'user', content: 'Hi' }],
      temperature: 0.5,
      maxTokens: 100,
    })

    expect(result.content).toBe('Hello')
    expect(result.inputTokens).toBe(10)
    expect(result.outputTokens).toBe(5)
    expect(result.model).toBe('moonshot-v1-8k')
    expect(multiModelClient.callModel).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'Hi' }],
        temperature: 0.5,
        maxTokens: 100,
      })
    )
  })
})
