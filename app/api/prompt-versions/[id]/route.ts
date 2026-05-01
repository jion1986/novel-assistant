import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'
import { z } from 'zod'

const patchSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  note: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/prompt-versions/[id]
 * 更新 Prompt 版本
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await request.json()

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues.map((e) => e.message).join(', ') },
      { status: 400 }
    )
  }

  // 如果激活此版本，先取消同类型的其他激活版本
  if (parsed.data.isActive) {
    const current = await prisma.promptVersion.findUnique({ where: { id } })
    if (current) {
      await prisma.promptVersion.updateMany({
        where: { taskType: current.taskType, isActive: true },
        data: { isActive: false },
      })
    }
  }

  const version = await prisma.promptVersion.update({
    where: { id },
    data: parsed.data,
  })

  return NextResponse.json({ success: true, data: version })
}

/**
 * DELETE /api/prompt-versions/[id]
 * 删除 Prompt 版本
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  await prisma.promptVersion.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
