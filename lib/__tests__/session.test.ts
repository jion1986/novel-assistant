/**
 * Session 工具函数测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readSession, writeSession, clearSession, requireAuth, sessionOptions } from '../session'
import { sealData, unsealData } from 'iron-session'
import { NextRequest, NextResponse } from 'next/server'

describe('readSession', () => {
  it('无 cookie 返回空 session', async () => {
    const req = new NextRequest('http://localhost/test')
    const session = await readSession(req)
    expect(session.isLoggedIn).toBeFalsy()
    expect(session.userId).toBeUndefined()
  })

  it('有效 cookie 返回 session 数据', async () => {
    const seal = await sealData(
      { userId: 'user-1', username: 'test', isLoggedIn: true },
      { password: sessionOptions.password, ttl: sessionOptions.cookieOptions.maxAge }
    )
    const req = new NextRequest('http://localhost/test', {
      headers: { cookie: `${sessionOptions.cookieName}=${seal}` },
    })
    const session = await readSession(req)
    expect(session.isLoggedIn).toBe(true)
    expect(session.userId).toBe('user-1')
    expect(session.username).toBe('test')
  })

  it('无效 cookie 返回空 session', async () => {
    const req = new NextRequest('http://localhost/test', {
      headers: { cookie: `${sessionOptions.cookieName}=invalid-seal` },
    })
    const session = await readSession(req)
    expect(session.isLoggedIn).toBeFalsy()
  })
})

describe('writeSession', () => {
  it('将 session 写入 response cookie', async () => {
    const response = NextResponse.json({})
    await writeSession({ userId: 'u1', username: 'test', isLoggedIn: true }, response)
    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toContain(sessionOptions.cookieName)
  })
})

describe('clearSession', () => {
  it('清除 response cookie', () => {
    const response = NextResponse.json({})
    clearSession(response)
    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toContain(`${sessionOptions.cookieName}=`)
    expect(setCookie).toContain('Max-Age=0')
  })
})

describe('requireAuth', () => {
  it('已登录返回 session', async () => {
    const seal = await sealData(
      { userId: 'user-1', username: 'test', isLoggedIn: true },
      { password: sessionOptions.password, ttl: sessionOptions.cookieOptions.maxAge }
    )
    const req = new NextRequest('http://localhost/test', {
      headers: { cookie: `${sessionOptions.cookieName}=${seal}` },
    })
    const session = await requireAuth(req)
    expect(session.userId).toBe('user-1')
  })

  it('未登录抛出错误', async () => {
    const req = new NextRequest('http://localhost/test')
    await expect(requireAuth(req)).rejects.toThrow('Unauthorized')
  })
})
