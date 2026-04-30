import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readSession, writeSession } from '@/lib/session'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

/**
 * POST /api/auth/login
 * 用户登录
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues.map((e) => e.message).join(', ') },
      { status: 400 }
    )
  }

  const { username, password } = parsed.data

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) {
    return NextResponse.json({ success: false, error: '用户名或密码错误' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    return NextResponse.json({ success: false, error: '用户名或密码错误' }, { status: 401 })
  }

  const response = NextResponse.json({
    success: true,
    data: { id: user.id, username: user.username },
  })

  await writeSession(
    { userId: user.id, username: user.username, isLoggedIn: true },
    response
  )

  return response
}
