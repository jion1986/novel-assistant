import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'
import { z } from 'zod'

const createSchema = z.object({
  taskType: z.string().min(1).max(50),
  version: z.string().min(1).max(20),
  content: z.string().min(1).max(10000),
  note: z.string().max(500).optional(),
})

/**
 * GET /api/prompt-versions
 * 获取所有 Prompt 版本（按任务类型分组）
 */
export async function GET(request: NextRequest) {
  const session = await readSession(request)
  const userId = session.userId!
  const versions = await prisma.promptVersion.findMany({
    orderBy: [{ taskType: 'asc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json({ success: true, data: versions })
}

/**
 * POST /api/prompt-versions
 * 创建新 Prompt 版本
 */
export async function POST(request: NextRequest) {
  const session = await readSession(request)
  const userId = session.userId!
  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues.map((e) => e.message).join(', ') },
      { status: 400 }
    )
  }

  try {
    const version = await prisma.promptVersion.create({
      data: parsed.data,
    })
    return NextResponse.json({ success: true, data: version }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
