/**
 * Server-side authentication utilities for API Route Handlers
 *
 * Reads auth context from the 'qc-auth' cookie (JSON-encoded UserInfo).
 * This is a bridge pattern: the client writes to both localStorage and cookie,
 * and the server reads from the cookie.
 *
 * Future migration path: replace JSON cookie with signed JWT token.
 */

import { type NextRequest } from 'next/server'

// ── Types ──────────────────────────────────────────────────────

export type ServerUserRole = 'hq_admin' | 'manager' | 'instructor' | 'agent'

export interface ServerAuthContext {
  userId: string
  userName: string
  role: ServerUserRole
  center: string | null
  service: string | null
  channel: string | null
  agentId: string | null
}

// ── Constants ──────────────────────────────────────────────────

const AUTH_COOKIE_NAME = 'qc-auth'

/** Allowed role values for validation */
const VALID_ROLES: ReadonlySet<string> = new Set<ServerUserRole>([
  'hq_admin',
  'manager',
  'instructor',
  'agent',
])

// ── Sanitization ───────────────────────────────────────────────

/**
 * Sanitize a string value for safe use in BigQuery SQL.
 * Prevents SQL injection by allowing only alphanumeric, Korean, dot, underscore, hyphen, space.
 */
function sanitizeSqlValue(value: string): string {
  // Strip anything that is not: word chars (incl. Korean via Unicode), dots, hyphens, spaces, slashes
  return value.replace(/[^\w가-힣.\-\s/]/g, '').trim()
}

/**
 * Validate that a string looks like a safe identifier (agentId, center name).
 * Returns the sanitized string, or null if the value is empty after sanitization.
 */
function sanitizeIdentifier(value: string | null | undefined): string | null {
  if (!value) return null
  const cleaned = sanitizeSqlValue(value)
  if (cleaned.length === 0 || cleaned.length > 100) return null
  return cleaned
}

// ── Core Functions ─────────────────────────────────────────────

/**
 * Extract auth context from the request.
 *
 * Reads from:
 * 1. Cookie 'qc-auth' (JSON-encoded UserInfo) -- primary
 * 2. Authorization header 'Bearer <base64-json>' -- fallback for programmatic clients
 *
 * Returns null if no valid auth is found.
 */
export function getServerAuth(request: NextRequest): ServerAuthContext | null {
  // 1. Try cookie first
  const cookieValue = request.cookies.get(AUTH_COOKIE_NAME)?.value
  if (cookieValue) {
    const parsed = parseAuthPayload(cookieValue)
    if (parsed) return parsed
  }

  // 2. Fallback: Authorization header (Bearer <base64-json>)
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    try {
      const decoded = atob(token)
      const parsed = parseAuthPayload(decoded)
      if (parsed) return parsed
    } catch {
      // Invalid base64 -- ignore
    }
  }

  return null
}

/**
 * Parse and validate a JSON auth payload string into ServerAuthContext.
 * Returns null if the payload is invalid.
 */
function parseAuthPayload(raw: string): ServerAuthContext | null {
  try {
    const decoded = decodeURIComponent(raw)
    const data: unknown = JSON.parse(decoded)

    if (!data || typeof data !== 'object') return null

    const obj = data as Record<string, unknown>

    // Validate required fields
    const userId = typeof obj.userId === 'string' ? obj.userId.trim() : ''
    const userName = typeof obj.userName === 'string' ? obj.userName.trim() : ''
    const role = typeof obj.role === 'string' ? obj.role : ''

    if (!userId || !userName || !VALID_ROLES.has(role)) return null

    return {
      userId,
      userName,
      role: role as ServerUserRole,
      center: sanitizeIdentifier(obj.center as string | null),
      service: sanitizeIdentifier(obj.service as string | null),
      channel: sanitizeIdentifier(obj.channel as string | null),
      agentId: sanitizeIdentifier(obj.agentId as string | null),
    }
  } catch {
    return null
  }
}

/**
 * Require authentication. Throws an Error if no valid auth context is found.
 * Use in API route handlers that must be authenticated.
 *
 * @example
 * ```ts
 * export async function GET(request: NextRequest) {
 *   const auth = requireAuth(request)
 *   // auth is guaranteed to be non-null
 * }
 * ```
 */
export function requireAuth(request: NextRequest): ServerAuthContext {
  const auth = getServerAuth(request)
  if (!auth) {
    throw new AuthError('인증이 필요합니다.', 401)
  }
  return auth
}

/**
 * Require that the authenticated user has one of the specified roles.
 * Throws an Error if the role check fails.
 *
 * @example
 * ```ts
 * const auth = requireAuth(request)
 * requireRole(auth, 'hq_admin', 'instructor')
 * ```
 */
export function requireRole(auth: ServerAuthContext, ...roles: ServerUserRole[]): void {
  if (!roles.includes(auth.role)) {
    throw new AuthError(
      `접근 권한이 없습니다. 필요 역할: ${roles.join(', ')}`,
      403,
    )
  }
}

// ── BigQuery Scope Filter ──────────────────────────────────────

/**
 * Generate a WHERE clause fragment for BigQuery queries based on the user's role.
 * This ensures data-level access control (row-level security).
 *
 * - hq_admin: no filter (sees everything)
 * - instructor: filtered by center
 * - manager: filtered by center
 * - agent: filtered by agent_id
 *
 * @param auth - The authenticated user context
 * @param alias - Table alias to prefix columns with (default: 'e')
 * @returns SQL WHERE fragment string (including leading AND), or empty string
 *
 * @example
 * ```ts
 * const filter = getScopeFilter(auth, 'e')
 * const sql = `SELECT * FROM table e WHERE 1=1 ${filter}`
 * ```
 */
export function getScopeFilter(auth: ServerAuthContext, alias: string = 'e'): string {
  switch (auth.role) {
    case 'hq_admin':
      return ''

    case 'instructor':
    case 'manager': {
      const center = sanitizeIdentifier(auth.center)
      if (!center) return ''
      // Use parameterized-style escaping: single quotes with escaped content
      const safeCenter = center.replace(/'/g, "\\'")
      return ` AND ${alias}.center = '${safeCenter}'`
    }

    case 'agent': {
      const agentId = sanitizeIdentifier(auth.agentId)
      if (!agentId) return ''
      const safeAgentId = agentId.replace(/'/g, "\\'")
      return ` AND ${alias}.agent_id = '${safeAgentId}'`
    }

    default:
      // Unknown role -- restrict to nothing
      return ' AND 1=0'
  }
}

// ── Auth Error Class ───────────────────────────────────────────

/**
 * Custom error class for authentication/authorization failures.
 * Includes an HTTP status code for use in API responses.
 */
export class AuthError extends Error {
  public readonly statusCode: number

  constructor(message: string, statusCode: number = 401) {
    super(message)
    this.name = 'AuthError'
    this.statusCode = statusCode
  }
}

// ── Helper: Build error response ───────────────────────────────

/**
 * Build a NextResponse JSON error from an AuthError.
 * Useful in catch blocks of API route handlers.
 *
 * @example
 * ```ts
 * import { NextResponse } from 'next/server'
 * import { requireAuth, AuthError, authErrorResponse } from '@/lib/auth-server'
 *
 * export async function GET(request: NextRequest) {
 *   try {
 *     const auth = requireAuth(request)
 *     // ... business logic
 *   } catch (err) {
 *     if (err instanceof AuthError) {
 *       return authErrorResponse(err)
 *     }
 *     throw err
 *   }
 * }
 * ```
 */
export function authErrorResponse(err: AuthError): Response {
  // Use native Response to avoid importing NextResponse in this server-only module
  return new Response(
    JSON.stringify({ success: false, error: err.message }),
    {
      status: err.statusCode,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}
