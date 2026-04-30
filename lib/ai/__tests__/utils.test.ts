/**
 * AI 工具函数单元测试
 */

import { describe, it, expect } from 'vitest'
import { generateTempSummary } from '../generateSummary'
import { estimateCost, fillTemplate, parseJsonResponse } from '../utils'

describe('generateTempSummary', () => {
  it('短文本保留完整', () => {
    const text = '这是一段很短的文本。'
    expect(generateTempSummary(text)).toBe(text)
  })

  it('长文本截断到约300字', () => {
    const text = '测试内容。'.repeat(100)
    const result = generateTempSummary(text)
    expect(result.length).toBeLessThan(400)
  })

  it('在句号处截断', () => {
    const text = '第一句。第二句很长很长' + 'x'.repeat(500)
    const result = generateTempSummary(text)
    expect(result.endsWith('。') || result.endsWith('……')).toBe(true)
  })
})

describe('estimateCost', () => {
  it('计算成本正确', () => {
    const cost = estimateCost(1000, 500)
    expect(cost).toBeCloseTo(0.018, 3)
  })

  it('零 tokens 返回 0', () => {
    expect(estimateCost(0, 0)).toBe(0)
  })
})

describe('fillTemplate', () => {
  it('替换所有占位符', () => {
    const template = 'Hello {{name}}, you are {{age}} years old.'
    const result = fillTemplate(template, { name: 'Alice', age: '30' })
    expect(result).toBe('Hello Alice, you are 30 years old.')
  })

  it('未匹配的占位符替换为空字符串', () => {
    const template = 'Hello {{name}}, {{missing}}'
    const result = fillTemplate(template, { name: 'Alice' })
    expect(result).toBe('Hello Alice, ')
  })

  it('空变量对象将所有占位符替换为空字符串', () => {
    const template = 'Hello {{name}}'
    const result = fillTemplate(template, {})
    expect(result).toBe('Hello ')
  })
})

describe('parseJsonResponse', () => {
  it('解析纯 JSON', () => {
    const data = parseJsonResponse<{ name: string }>('{"name":"Alice"}')
    expect(data.name).toBe('Alice')
  })

  it('解析 markdown 代码块包裹的 JSON', () => {
    const data = parseJsonResponse<{ name: string }>('```json\n{"name":"Alice"}\n```')
    expect(data.name).toBe('Alice')
  })

  it('解析普通代码块包裹的 JSON', () => {
    const data = parseJsonResponse<{ name: string }>('```\n{"name":"Alice"}\n```')
    expect(data.name).toBe('Alice')
  })

  it('无效 JSON 抛出错误', () => {
    expect(() => parseJsonResponse('not json')).toThrow('Failed to parse')
  })
})
