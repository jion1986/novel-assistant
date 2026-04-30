import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'

interface RouteParams {
  params: Promise<{ bookId: string; characterId: string }>
}

/**
 * PATCH /api/books/[bookId]/characters/[characterId]
 * 更新角色信息
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId, characterId } = await params
  const body = await request.json()

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  try {
    const character = await prisma.character.update({
      where: { id: characterId, bookId },
      data: {
        name: body.name,
        role: body.role,
        age: body.age,
        identity: body.identity,
        personality: body.personality,
        goal: body.goal,
        relationships: body.relationships,
        speakingStyle: body.speakingStyle,
        currentStatus: body.currentStatus,
        lockedFacts: body.lockedFacts,
      },
    })
    return NextResponse.json({ success: true, data: character })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/books/[bookId]/characters/[characterId]
 * 删除角色
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId, characterId } = await params

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  try {
    await prisma.character.delete({ where: { id: characterId, bookId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
