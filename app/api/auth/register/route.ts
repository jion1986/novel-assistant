import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { writeSession } from '@/lib/session'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const registerSchema = z.object({
  username: z.string().min(3).max(30),
  password: z.string().min(6).max(100),
})

/**
 * POST /api/auth/register
 * 用户注册（注册后自动登录）
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues.map((e) => e.message).join(', ') },
      { status: 400 }
    )
  }

  const { username, password } = parsed.data

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    return NextResponse.json({ success: false, error: '用户名已存在' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { username, password: passwordHash },
  })

  const response = NextResponse.json(
    { success: true, data: { id: user.id, username: user.username } },
    { status: 201 }
  )

  await writeSession(
    { userId: user.id, username: user.username, isLoggedIn: true },
    response
  )

  return response
}
