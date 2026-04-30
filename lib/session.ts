import { unsealData, sealData } from 'iron-session'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export interface SessionData {
  userId?: string
  username?: string
  isLoggedIn?: boolean
}

export const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'novel-session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  },
}

/**
 * 读取 session（只读，适用于 middleware、API routes、Server Components）
 */
export async function readSession(req?: NextRequest): Promise<SessionData> {
  let seal: string | undefined

  if (req) {
    seal = req.cookies.get(sessionOptions.cookieName)?.value
  } else {
    const cookieStore = await cookies()
    seal = cookieStore.get(sessionOptions.cookieName)?.value
  }

  if (!seal) return {}

  try {
    return await unsealData<SessionData>(seal, {
      password: sessionOptions.password,
      ttl: sessionOptions.cookieOptions.maxAge,
    })
  } catch {
    return {}
  }
}

/**
 * 将 session 数据 seal 并设置到 response cookie
 */
export async function writeSession(
  data: SessionData,
  response: NextResponse
): Promise<void> {
  const seal = await sealData(data, {
    password: sessionOptions.password,
    ttl: sessionOptions.cookieOptions.maxAge,
  })
  response.cookies.set(sessionOptions.cookieName, seal, sessionOptions.cookieOptions)
}

/**
 * 清除 session cookie
 */
export function clearSession(response: NextResponse): void {
  response.cookies.set(sessionOptions.cookieName, '', {
    ...sessionOptions.cookieOptions,
    maxAge: 0,
  })
}

/**
 * 要求已登录，否则抛出错误
 */
export async function requireAuth(req?: NextRequest): Promise<SessionData> {
  const session = await readSession(req)
  if (!session.isLoggedIn || !session.userId) {
    throw new Error('Unauthorized')
  }
  return session
}
