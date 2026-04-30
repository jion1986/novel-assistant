import { NextResponse } from 'next/server'
import { clearSession } from '@/lib/session'

/**
 * POST /api/auth/logout
 * 用户登出
 */
export async function POST() {
  const response = NextResponse.json({ success: true })
  clearSession(response)
  return response
}
