/**
 * 成本估算工具测试
 */

import { describe, it, expect } from 'vitest'
import {
  estimateSettingCost,
  estimateCharactersCost,
  estimateOutlineCost,
  estimateWriteChapterCost,
  formatCost,
  formatTokens,
} from '../costEstimator'

describe('estimateSettingCost', () => {
  it('估算设定生成成本', () => {
    const result = estimateSettingCost('一个修仙世界')
    expect(result.inputTokens).toBeGreaterThan(0)
    expect(result.outputTokens).toBe(500)
    expect(result.totalTokens).toBe(result.inputTokens + result.outputTokens)
    expect(result.cost).toBeGreaterThan(0)
  })
})

describe('estimateCharactersCost', () => {
  it('估算人设生成成本', () => {
    const result = estimateCharactersCost('主角是一位剑客')
    expect(result.inputTokens).toBeGreaterThan(0)
    expect(result.outputTokens).toBe(1200)
    expect(result.cost).toBeGreaterThan(0)
  })
})

describe('estimateOutlineCost', () => {
  it('估算大纲生成成本', () => {
    const result = estimateOutlineCost('一个复仇故事', 5)
    expect(result.inputTokens).toBeGreaterThan(0)
    expect(result.outputTokens).toBe(3000)
    expect(result.cost).toBeGreaterThan(0)
  })
})

describe('estimateWriteChapterCost', () => {
  it('估算写章节成本', () => {
    const result = estimateWriteChapterCost(2000)
    expect(result.inputTokens).toBe(3000)
    expect(result.outputTokens).toBe(4000)
    expect(result.cost).toBeGreaterThan(0)
  })
})

describe('formatCost', () => {
  it('小于 1 分显示厘', () => {
    expect(formatCost(0.005)).toContain('厘')
  })

  it('小于 1 角显示分', () => {
    expect(formatCost(0.05)).toContain('分')
  })

  it('小于 1 元显示角', () => {
    expect(formatCost(0.5)).toContain('角')
  })

  it('大于等于 1 元显示元', () => {
    expect(formatCost(1.5)).toContain('元')
  })
})

describe('formatTokens', () => {
  it('小于 1000 显示原数字', () => {
    expect(formatTokens(500)).toBe('500')
  })

  it('大于等于 1000 显示 K', () => {
    expect(formatTokens(1500)).toBe('1.5K')
  })
})
