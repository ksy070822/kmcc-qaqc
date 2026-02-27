/**
 * Next.js Middleware -- Role-Based Access Control (RBAC)
 *
 * Runs on Edge Runtime for every matched request.
 * Reads the 'qc-auth' cookie (JSON-encoded UserInfo) and enforces:
 *   1. Unauthenticated users -> redirect to /login
 *   2. Role-based route access control
 *   3. Unauthorized users -> redirect to their role's home page
 *   4. Injects x-user-* headers for downstream API routes
 *
 * Cookie format: JSON-encoded { userId, userName, role, center, service, channel, agentId }
 * (Same structure as lib/auth.ts UserInfo, written by client-side setAuthCookie)
 */

import { NextRequest, NextResponse } from 'next/server'

// ── Types (duplicated from lib/auth.ts for Edge Runtime compatibility) ──

type UserRole = 'hq_admin' | 'manager' | 'instructor' | 'agent'

interface AuthPayload {
  userId: string
  userName: string
  role: UserRole
  center: string | null
  service: string | null
  channel: string | null
  agentId: string | null
}

// ── Constants ──────────────────────────────────────────────────

const AUTH_COOKIE_NAME = 'qc-auth'

const VALID_ROLES: ReadonlySet<string> = new Set<UserRole>([
  'hq_admin', 'manager', 'instructor', 'agent',
])

/** Role -> default home route */
const ROLE_HOME: Record<UserRole, string> = {
  hq_admin: '/',
  manager: '/manager',
  instructor: '/instructor',
  agent: '/mypage',
}

/** Paths that never require authentication */
const PUBLIC_PATHS = [
  '/login',
  '/api/health',
  '/api/auth',
  '/api/sync',
  '/api/sync-sheets',
  '/api/import-sheets-2025',
  '/api/import-qa',
  '/api/cron',
] as const

/** API paths that require auth but are accessible to any authenticated user */
const COMMON_API_PATHS = [
  '/api/data',
  '/api/agents',
  '/api/health',
] as const

/**
 * Role-based page route access.
 * Each role lists the path prefixes it can access.
 * hq_admin can access everything (wildcard).
 */
const ROLE_PAGE_ACCESS: Record<UserRole, readonly string[]> = {
  hq_admin: ['*'],               // Full access
  instructor: ['/instructor'],    // Instructor pages
  manager: ['/manager'],          // Manager pages
  agent: ['/mypage'],             // Agent self-service
}

/**
 * Role-based API route access.
 * Controls which /api/* prefixes each role can call.
 * hq_admin can access all APIs.
 */
const ROLE_API_ACCESS: Record<UserRole, readonly string[]> = {
  hq_admin: ['*'],
  instructor: [
    '/api/data',
    '/api/agents',
    '/api/coaching',
    '/api/watchlist',
    '/api/goals',
    '/api/reports',
    '/api/predictions',
    '/api/underperforming',
    '/api/weekly-reports',
    '/api/role-metrics',
    '/api/check-agent',
    '/api/mypage',
    '/api/notices',
  ],
  manager: [
    '/api/data',
    '/api/agents',
    '/api/weekly-reports',
    '/api/underperforming',
    '/api/watchlist',
    '/api/goals',
    '/api/role-metrics',
    '/api/check-agent',
    '/api/mypage',
    '/api/manager',
    '/api/notices',
  ],
  agent: [
    '/api/mypage',
    '/api/role-metrics',
    '/api/coaching',
    '/api/check-agent',
  ],
}

// ── Helpers ────────────────────────────────────────────────────

function parseAuthCookie(cookieValue: string): AuthPayload | null {
  try {
    const decoded = decodeURIComponent(cookieValue)
    const data: unknown = JSON.parse(decoded)
    if (!data || typeof data !== 'object') return null

    const obj = data as Record<string, unknown>
    const userId = typeof obj.userId === 'string' ? obj.userId.trim() : ''
    const userName = typeof obj.userName === 'string' ? obj.userName.trim() : ''
    const role = typeof obj.role === 'string' ? obj.role : ''

    if (!userId || !userName || !VALID_ROLES.has(role)) return null

    return {
      userId,
      userName,
      role: role as UserRole,
      center: typeof obj.center === 'string' ? obj.center : null,
      service: typeof obj.service === 'string' ? obj.service : null,
      channel: typeof obj.channel === 'string' ? obj.channel : null,
      agentId: typeof obj.agentId === 'string' ? obj.agentId : null,
    }
  } catch {
    return null
  }
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') // Files with extensions (images, fonts, etc.)
  )
}

function isPageAllowed(role: UserRole, pathname: string): boolean {
  const allowed = ROLE_PAGE_ACCESS[role]
  if (allowed.includes('*')) return true
  return allowed.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))
}

function isApiAllowed(role: UserRole, pathname: string): boolean {
  // Common APIs are open to any authenticated user
  if (COMMON_API_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return true
  }
  const allowed = ROLE_API_ACCESS[role]
  if (allowed.includes('*')) return true
  return allowed.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))
}

// ── Middleware ──────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Static assets and internal Next.js routes -- always pass through
  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  // 2. Public paths -- always accessible
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // 3. Read auth cookie
  const cookieValue = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const auth = cookieValue ? parseAuthCookie(cookieValue) : null

  // 4. Unauthenticated
  if (!auth) {
    // API requests -> 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 },
      )
    }
    // Page requests -> redirect to /login with return URL
    const loginUrl = new URL('/login', request.url)
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  // 5. Authenticated user on /login -> redirect to their home
  if (pathname === '/login') {
    return NextResponse.redirect(new URL(ROLE_HOME[auth.role], request.url))
  }

  // 6. API route authorization
  if (pathname.startsWith('/api/')) {
    if (!isApiAllowed(auth.role, pathname)) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 },
      )
    }

    // Inject user headers for API route handlers
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', auth.userId)
    requestHeaders.set('x-user-role', auth.role)
    if (auth.center) requestHeaders.set('x-user-center', encodeURIComponent(auth.center))
    if (auth.service) requestHeaders.set('x-user-service', encodeURIComponent(auth.service))
    if (auth.channel) requestHeaders.set('x-user-channel', encodeURIComponent(auth.channel))
    if (auth.agentId) requestHeaders.set('x-user-agent-id', auth.agentId)

    return NextResponse.next({
      request: { headers: requestHeaders },
    })
  }

  // 7. Page route authorization
  if (!isPageAllowed(auth.role, pathname)) {
    // Redirect to the user's role-appropriate home page
    const homeUrl = new URL(ROLE_HOME[auth.role], request.url)
    return NextResponse.redirect(homeUrl)
  }

  // 8. Authorized -- pass through with user headers
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-id', auth.userId)
  requestHeaders.set('x-user-role', auth.role)
  if (auth.center) requestHeaders.set('x-user-center', encodeURIComponent(auth.center))
  if (auth.service) requestHeaders.set('x-user-service', encodeURIComponent(auth.service))
  if (auth.channel) requestHeaders.set('x-user-channel', encodeURIComponent(auth.channel))
  if (auth.agentId) requestHeaders.set('x-user-agent-id', auth.agentId)

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

// ── Matcher Configuration ──────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets with file extensions
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)).*)',
  ],
}
