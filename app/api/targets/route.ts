/**
 * Multi-Domain Targets API
 *
 * GET    /api/targets?domain=qc&year=2026&center=용산
 * POST   /api/targets   (body: MultiDomainTarget) - 새 목표 생성
 * PUT    /api/targets   (body: { targetId, ...수정필드 }) - 목표 수정
 *
 * - GET: 인증된 모든 사용자 접근 가능
 * - POST/PUT: hq_admin 역할만 쓰기 가능
 */

import { NextRequest, NextResponse } from "next/server"
import {
  getTargets,
  saveTarget,
  deactivateTarget,
  type MultiDomainTarget,
  type TargetDomain,
} from "@/lib/bigquery-targets"
import { getCorsHeaders } from "@/lib/cors"
import {
  requireAuth,
  requireRole,
  AuthError,
  authErrorResponse,
} from "@/lib/auth-server"

const corsHeaders = getCorsHeaders()

// ── CORS preflight ─────────────────────────────────────────────

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

// ── Valid domain values ────────────────────────────────────────

const VALID_DOMAINS: ReadonlySet<string> = new Set<TargetDomain>([
  "qc",
  "qa",
  "csat",
  "sla",
  "productivity",
])

// ── GET /api/targets ───────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)

    const { searchParams } = new URL(request.url)
    const domain = searchParams.get("domain") || undefined
    const yearStr = searchParams.get("year")
    const center = searchParams.get("center") || undefined

    // domain 유효성 검증
    if (domain && !VALID_DOMAINS.has(domain)) {
      return NextResponse.json(
        {
          success: false,
          error: `유효하지 않은 domain 값입니다: ${domain}. 허용: qc, qa, csat, sla, productivity`,
        },
        { status: 400, headers: corsHeaders },
      )
    }

    const year = yearStr ? parseInt(yearStr, 10) : undefined
    if (yearStr && (isNaN(year!) || year! < 2020 || year! > 2100)) {
      return NextResponse.json(
        { success: false, error: `유효하지 않은 year 값입니다: ${yearStr}` },
        { status: 400, headers: corsHeaders },
      )
    }

    console.log(`[API] targets GET: domain=${domain}, year=${year}, center=${center}, user=${auth.userId}`)

    const result = await getTargets({ domain, year, center })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500, headers: corsHeaders },
      )
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { headers: corsHeaders },
    )
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[API] targets GET error:", err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500, headers: corsHeaders },
    )
  }
}

// ── POST /api/targets ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    requireRole(auth, "hq_admin")

    const body = await request.json()

    // 필수 필드 검증
    if (
      !body.domain ||
      !body.year ||
      !body.center ||
      !body.targetSubtype ||
      body.targetValue === undefined ||
      body.targetValue === null
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "필수 필드가 누락되었습니다: domain, year, center, targetSubtype, targetValue",
        },
        { status: 400, headers: corsHeaders },
      )
    }

    // domain 유효성
    if (!VALID_DOMAINS.has(body.domain)) {
      return NextResponse.json(
        {
          success: false,
          error: `유효하지 않은 domain 값입니다: ${body.domain}`,
        },
        { status: 400, headers: corsHeaders },
      )
    }

    // targetValue 숫자 검증
    const targetValue = Number(body.targetValue)
    if (isNaN(targetValue)) {
      return NextResponse.json(
        { success: false, error: `targetValue가 숫자가 아닙니다: ${body.targetValue}` },
        { status: 400, headers: corsHeaders },
      )
    }

    const target: MultiDomainTarget = {
      targetId: body.targetId || undefined,
      domain: body.domain as TargetDomain,
      year: Number(body.year),
      center: String(body.center),
      targetSubtype: String(body.targetSubtype),
      targetValue,
      targetUnit: String(body.targetUnit || "%"),
      isActive: body.isActive !== false,
      updatedBy: auth.userId,
    }

    console.log(`[API] targets POST: ${JSON.stringify(target)}, user=${auth.userId}`)

    const result = await saveTarget(target)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500, headers: corsHeaders },
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: "목표가 생성되었습니다.",
        data: result.data,
      },
      { headers: corsHeaders },
    )
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[API] targets POST error:", err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500, headers: corsHeaders },
    )
  }
}

// ── PUT /api/targets ───────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    requireRole(auth, "hq_admin")

    const body = await request.json()

    // targetId 필수
    if (!body.targetId) {
      return NextResponse.json(
        { success: false, error: "targetId가 필요합니다." },
        { status: 400, headers: corsHeaders },
      )
    }

    // 비활성화 요청
    if (body.isActive === false && Object.keys(body).length <= 2) {
      console.log(`[API] targets PUT deactivate: ${body.targetId}, user=${auth.userId}`)
      const result = await deactivateTarget(body.targetId)
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500, headers: corsHeaders },
        )
      }
      return NextResponse.json(
        { success: true, message: "목표가 비활성화되었습니다." },
        { headers: corsHeaders },
      )
    }

    // 수정: 필수 필드 검증
    if (
      !body.domain ||
      !body.year ||
      !body.center ||
      !body.targetSubtype ||
      body.targetValue === undefined ||
      body.targetValue === null
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "필수 필드가 누락되었습니다: domain, year, center, targetSubtype, targetValue",
        },
        { status: 400, headers: corsHeaders },
      )
    }

    // domain 유효성
    if (!VALID_DOMAINS.has(body.domain)) {
      return NextResponse.json(
        {
          success: false,
          error: `유효하지 않은 domain 값입니다: ${body.domain}`,
        },
        { status: 400, headers: corsHeaders },
      )
    }

    const targetValue = Number(body.targetValue)
    if (isNaN(targetValue)) {
      return NextResponse.json(
        { success: false, error: `targetValue가 숫자가 아닙니다: ${body.targetValue}` },
        { status: 400, headers: corsHeaders },
      )
    }

    const target: MultiDomainTarget = {
      targetId: String(body.targetId),
      domain: body.domain as TargetDomain,
      year: Number(body.year),
      center: String(body.center),
      targetSubtype: String(body.targetSubtype),
      targetValue,
      targetUnit: String(body.targetUnit || "%"),
      isActive: body.isActive !== false,
      updatedBy: auth.userId,
    }

    console.log(`[API] targets PUT: ${JSON.stringify(target)}, user=${auth.userId}`)

    const result = await saveTarget(target)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500, headers: corsHeaders },
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: "목표가 수정되었습니다.",
        data: result.data,
      },
      { headers: corsHeaders },
    )
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[API] targets PUT error:", err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500, headers: corsHeaders },
    )
  }
}
