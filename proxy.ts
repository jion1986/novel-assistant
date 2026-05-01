import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { readSession } from './lib/session'

// 公开路由（不需要登录）
const publicRoutes = ['/login', '/api/auth']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 公开路由直接放行
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // 静态资源放行
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/static')
  ) {
    return NextResponse.next()
  }

  const session = await readSession(request)

  if (!session.isLoggedIn) {
    // API 路由返回 401
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    // 页面路由重定向到登录页
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
