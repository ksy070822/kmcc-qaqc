/**
 * Multi-Domain Targets - BigQuery CRUD
 *
 * 기존 targets 테이블에 추가된 멀티도메인 컬럼(domain, year, target_value,
 * target_unit, target_subtype)을 활용한 목표 관리 함수들.
 *
 * BQ 컬럼명은 snake_case, TypeScript 인터페이스는 camelCase.
 * 5분 캐시(Map + timestamp)로 반복 조회 성능 최적화.
 */

import { BigQuery } from "@google-cloud/bigquery"
import {
  CENTER_TARGET_RATES,
  CSAT_TARGET_SCORE,
  CSAT_SERVICE_TARGETS,
} from "@/lib/constants"

// ── BigQuery client ────────────────────────────────────────────

const bq = new BigQuery({
  projectId: "csopp-25f2",
  location: "asia-northeast3",
})

const DATASET = "KMCC_QC"
const TABLE = "targets"
const FQ_TABLE = `csopp-25f2.${DATASET}.${TABLE}`

// ── Types ──────────────────────────────────────────────────────

export type TargetDomain = "qc" | "qa" | "csat" | "sla" | "productivity"

export interface MultiDomainTarget {
  targetId?: string
  domain: TargetDomain
  year: number
  center: string // '용산' | '광주' | '전체'
  targetSubtype: string
  targetValue: number
  targetUnit: string // '%' | '점' | '초'
  isActive: boolean
  updatedAt?: string
  updatedBy?: string
}

// ── Cache ──────────────────────────────────────────────────────

interface CacheEntry {
  value: number
  timestamp: number
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5분

/** domain_subtype_center_year -> CacheEntry */
const targetCache = new Map<string, CacheEntry>()

function cacheKey(
  domain: string,
  subtype: string,
  center: string,
  year: number,
): string {
  return `${domain}_${subtype}_${center}_${year}`
}

function getCached(key: string): number | null {
  const entry = targetCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    targetCache.delete(key)
    return null
  }
  return entry.value
}

function setCache(key: string, value: number): void {
  targetCache.set(key, { value, timestamp: Date.now() })
}

// ── Helpers ────────────────────────────────────────────────────

function buildTargetId(
  domain: string,
  year: number,
  center: string,
  subtype: string,
): string {
  return `${domain}_${year}_${center}_${subtype}`
}

function rowToTarget(row: Record<string, unknown>): MultiDomainTarget {
  return {
    targetId: String(row.target_id ?? ""),
    domain: String(row.domain ?? "qc") as TargetDomain,
    year: Number(row.year ?? new Date().getFullYear()),
    center: String(row.center ?? "전체"),
    targetSubtype: String(row.target_subtype ?? ""),
    targetValue: Number(row.target_value ?? row.target_rate ?? 0),
    targetUnit: String(row.target_unit ?? "%"),
    isActive: row.is_active !== false,
    updatedAt: row.updated_at
      ? String(
          (row.updated_at as { value?: string }).value ?? row.updated_at,
        )
      : undefined,
    updatedBy: row.updated_by ? String(row.updated_by) : undefined,
  }
}

// ── CRUD Functions ─────────────────────────────────────────────

/**
 * 목표 목록 조회 (필터링)
 */
export async function getTargets(filters: {
  domain?: string
  year?: number
  center?: string
}): Promise<{ success: boolean; data?: MultiDomainTarget[]; error?: string }> {
  try {
    const conditions: string[] = ["1=1"]
    const params: Record<string, string | number> = {}

    if (filters.domain) {
      conditions.push("domain = @domain")
      params.domain = filters.domain
    }
    if (filters.year) {
      conditions.push("year = @year")
      params.year = filters.year
    }
    if (filters.center) {
      conditions.push("center = @center")
      params.center = filters.center
    }

    const query = `
      SELECT
        target_id, target_name, center, target_type,
        target_rate, period_type, period_start, period_end,
        is_active, domain, year, target_value, target_unit,
        target_subtype, updated_at
      FROM \`${FQ_TABLE}\`
      WHERE ${conditions.join(" AND ")}
      ORDER BY domain, year DESC, center, target_subtype
    `

    const [rows] = await bq.query({ query, params })
    const data = (rows as Record<string, unknown>[]).map(rowToTarget)

    return { success: true, data }
  } catch (err) {
    console.error("[bigquery-targets] getTargets error:", err)
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 목표 저장 (upsert via MERGE)
 */
export async function saveTarget(
  target: MultiDomainTarget,
): Promise<{ success: boolean; data?: { targetId: string }; error?: string }> {
  try {
    const targetId =
      target.targetId ||
      buildTargetId(target.domain, target.year, target.center, target.targetSubtype)

    const targetName = `${target.domain.toUpperCase()} ${target.targetSubtype} 목표 (${target.center} ${target.year})`
    const now = new Date().toISOString()

    const query = `
      MERGE \`${FQ_TABLE}\` AS T
      USING (
        SELECT
          @targetId AS target_id,
          @targetName AS target_name,
          @center AS center,
          @targetSubtype AS target_type,
          @targetValue AS target_rate,
          'yearly' AS period_type,
          DATE(CONCAT(CAST(@year AS STRING), '-01-01')) AS period_start,
          DATE(CONCAT(CAST(@year AS STRING), '-12-31')) AS period_end,
          @isActive AS is_active,
          @domain AS domain,
          @year AS year,
          @targetValue AS target_value,
          @targetUnit AS target_unit,
          @targetSubtype AS target_subtype
      ) AS S
      ON T.target_id = S.target_id
      WHEN MATCHED THEN
        UPDATE SET
          target_value = S.target_value,
          target_rate = S.target_rate,
          target_unit = S.target_unit,
          is_active = S.is_active,
          updated_at = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN
        INSERT (target_id, target_name, center, target_type, target_rate,
                period_type, period_start, period_end, is_active,
                domain, year, target_value, target_unit, target_subtype,
                created_at, updated_at)
        VALUES (S.target_id, S.target_name, S.center, S.target_type, S.target_rate,
                S.period_type, S.period_start, S.period_end, S.is_active,
                S.domain, S.year, S.target_value, S.target_unit, S.target_subtype,
                CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
    `

    await bq.query({
      query,
      params: {
        targetId,
        targetName,
        center: target.center,
        targetSubtype: target.targetSubtype,
        targetValue: target.targetValue,
        targetUnit: target.targetUnit,
        isActive: target.isActive,
        domain: target.domain,
        year: target.year,
      },
    })

    // 캐시 갱신
    const key = cacheKey(target.domain, target.targetSubtype, target.center, target.year)
    setCache(key, target.targetValue)

    console.log(`[bigquery-targets] saveTarget: ${targetId} saved (${now})`)
    return { success: true, data: { targetId } }
  } catch (err) {
    console.error("[bigquery-targets] saveTarget error:", err)
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 목표 비활성화 (soft delete)
 */
export async function deactivateTarget(
  targetId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const query = `
      UPDATE \`${FQ_TABLE}\`
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP()
      WHERE target_id = @targetId
    `

    await bq.query({ query, params: { targetId } })

    // 캐시에서 해당 항목 무효화 (targetId 파싱)
    const parts = targetId.split("_")
    if (parts.length >= 4) {
      const [domain, yearStr, center, ...subtypeParts] = parts
      const key = cacheKey(domain, subtypeParts.join("_"), center, Number(yearStr))
      targetCache.delete(key)
    }

    console.log(`[bigquery-targets] deactivateTarget: ${targetId}`)
    return { success: true }
  } catch (err) {
    console.error("[bigquery-targets] deactivateTarget error:", err)
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 특정 도메인/subtype/센터의 목표값 조회 (5분 캐시 + 상수 폴백)
 *
 * 우선순위:
 * 1. 캐시 (5분 TTL)
 * 2. BigQuery targets 테이블
 * 3. constants.ts 폴백 (CENTER_TARGET_RATES, CSAT_TARGET_SCORE 등)
 */
export async function getTargetValue(
  domain: TargetDomain,
  subtype: string,
  center: string,
  year?: number,
): Promise<number | null> {
  const targetYear = year ?? new Date().getFullYear()
  const key = cacheKey(domain, subtype, center, targetYear)

  // 1. 캐시 확인
  const cached = getCached(key)
  if (cached !== null) return cached

  // 2. BQ 조회
  try {
    const query = `
      SELECT target_value
      FROM \`${FQ_TABLE}\`
      WHERE domain = @domain
        AND target_subtype = @subtype
        AND center = @center
        AND year = @year
        AND is_active = TRUE
      LIMIT 1
    `
    const [rows] = await bq.query({
      query,
      params: { domain, subtype, center, year: targetYear },
    })

    const resultRows = rows as Record<string, unknown>[]
    if (resultRows.length > 0 && resultRows[0].target_value != null) {
      const value = Number(resultRows[0].target_value)
      setCache(key, value)
      return value
    }
  } catch (err) {
    console.warn("[bigquery-targets] getTargetValue BQ error, falling back:", err)
  }

  // 3. constants.ts 폴백
  const fallback = getFallbackTargetValue(domain, subtype, center)
  if (fallback !== null) {
    setCache(key, fallback)
  }
  return fallback
}

// ── Fallback from constants.ts ─────────────────────────────────

function getFallbackTargetValue(
  domain: TargetDomain,
  subtype: string,
  center: string,
): number | null {
  // QC 폴백: CENTER_TARGET_RATES
  if (domain === "qc") {
    const centerKey = center as keyof typeof CENTER_TARGET_RATES
    const rates = CENTER_TARGET_RATES[centerKey]
    if (!rates) return null

    if (subtype === "attitude") return rates.attitude
    if (subtype === "ops") return rates.ops
    if (subtype === "total") {
      // 태도+오상담 평균
      return Number(((rates.attitude + rates.ops) / 2).toFixed(2))
    }
    return null
  }

  // QA 폴백: 하드코딩 (CLAUDE.md 기준: 유선 88, 채팅 90, 합계 90)
  if (domain === "qa") {
    if (subtype === "voice") return 88
    if (subtype === "chat") return 90
    if (subtype === "total") return 90
    return null
  }

  // CSAT 폴백: CSAT_TARGET_SCORE, CSAT_SERVICE_TARGETS
  if (domain === "csat") {
    if (subtype === "overall") return CSAT_TARGET_SCORE
    const serviceTarget = CSAT_SERVICE_TARGETS[subtype]
    if (serviceTarget != null) return serviceTarget
    return null
  }

  // SLA 폴백
  if (domain === "sla") {
    if (subtype === "total") return 90
    return null
  }

  // 생산성 폴백
  if (domain === "productivity") {
    if (subtype === "voice_response" || subtype === "chat_response") return 95
    return null
  }

  return null
}
