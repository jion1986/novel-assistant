/**
 * 通用工具函数测试
 */

import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('cn', () => {
  it('合并多个 className', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('处理条件类名', () => {
    expect(cn('base', false && 'hidden', true && 'block')).toBe('base block')
  })

  it('合并 Tailwind 冲突类名', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('空输入返回空字符串', () => {
    expect(cn()).toBe('')
  })
})
