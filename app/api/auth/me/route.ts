import { NextRequest, NextResponse } from 'next/server'
import { readSession } from '@/lib/session'

/**
 * GET /api/auth/me
 * 获取当前登录用户
 */
export async function GET(request: NextRequest) {
  const session = await readSession(request)
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  return NextResponse.json({
    success: true,
    data: { userId: session.userId, username: session.username },
  })
}
