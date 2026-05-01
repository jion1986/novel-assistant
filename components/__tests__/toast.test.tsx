/**
 * Toast 组件测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ToastContainer, toast } from '../toast'

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('初始状态不渲染', () => {
    render(<ToastContainer />)
    expect(screen.queryByText(/test message/)).not.toBeInTheDocument()
  })

  it('toast 调用后显示消息', () => {
    render(<ToastContainer />)
    act(() => {
      toast('测试消息', 'success')
    })
    expect(screen.getByText('测试消息')).toBeInTheDocument()
  })

  it('3 秒后自动消失', () => {
    render(<ToastContainer />)
    act(() => {
      toast('临时消息', 'info')
    })
    expect(screen.getByText('临时消息')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.queryByText('临时消息')).not.toBeInTheDocument()
  })

  it('支持多个 toast 堆叠', () => {
    render(<ToastContainer />)
    act(() => {
      toast('第一条', 'success')
      toast('第二条', 'error')
    })
    expect(screen.getByText('第一条')).toBeInTheDocument()
    expect(screen.getByText('第二条')).toBeInTheDocument()
  })
})
