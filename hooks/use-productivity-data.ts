"use client"

import { useQuery } from "@tanstack/react-query"
import type {
  ProductivityOverview,
  ProductivityVerticalStats,
  ProductivityProcessingTime,
  ProductivityDailyTrend,
  BoardStats,
  ForeignLangStats,
  WeeklySummaryRow,
} from "@/lib/types"

interface VoiceData {
  overview: ProductivityOverview[]
  verticalStats: ProductivityVerticalStats[]
}

interface ChatData {
  overview: ProductivityOverview[]
  verticalStats: ProductivityVerticalStats[]
  processingTime: ProductivityProcessingTime[]
}

interface ProductivityDataBundle {
  voiceData: VoiceData | null
  voiceTime: ProductivityProcessingTime[] | null
  voiceTrend: ProductivityDailyTrend[] | null
  chatData: ChatData | null
  chatTrend: ProductivityDailyTrend[] | null
  boardData: BoardStats[] | null
  foreignData: ForeignLangStats[] | null
  voiceWeeklySummary: WeeklySummaryRow[] | null
  chatWeeklySummary: WeeklySummaryRow[] | null
  prevVoiceData: VoiceData | null
  prevVoiceTime: ProductivityProcessingTime[] | null
  prevChatData: ChatData | null
}

interface UseProductivityDataReturn {
  voiceData: VoiceData | null
  voiceTime: ProductivityProcessingTime[] | null
  voiceTrend: ProductivityDailyTrend[] | null
  chatData: ChatData | null
  chatTrend: ProductivityDailyTrend[] | null
  boardData: BoardStats[] | null
  foreignData: ForeignLangStats[] | null
  voiceWeeklySummary: WeeklySummaryRow[] | null
  chatWeeklySummary: WeeklySummaryRow[] | null
  prevVoiceData: VoiceData | null
  prevVoiceTime: ProductivityProcessingTime[] | null
  prevChatData: ChatData | null
  loading: boolean
  error: string | null
  refetch: () => void
}

// ── helpers ──────────────────────────────────────────────────────────

function buildQuery(
  type: string,
  month?: string,
  startDate?: string,
  endDate?: string,
  extra?: Record<string, string>,
  scope?: { center?: string; service?: string },
): string {
  const params = new URLSearchParams({ type })
  if (startDate && endDate) {
    params.set("startDate", startDate)
    params.set("endDate", endDate)
  } else if (month) {
    params.set("month", month)
  }
  if (scope?.center) params.set("center", scope.center)
  if (scope?.service) params.set("service", scope.service)
  if (extra) {
    for (const [k, v] of Object.entries(extra)) params.set(k, v)
  }
  return `/api/data?${params}`
}

async function fetchData<T>(
  type: string,
  month?: string,
  startDate?: string,
  endDate?: string,
  extra?: Record<string, string>,
  scope?: { center?: string; service?: string },
): Promise<T | null> {
  try {
    const res = await fetch(buildQuery(type, month, startDate, endDate, extra, scope))
    const json = await res.json()
    if (json.success && json.data) return json.data as T
    console.error(`[Productivity] ${type} error:`, json.error)
    return null
  } catch (err) {
    console.error(`[Productivity] ${type} fetch error:`, err)
    return null
  }
}

/** 이전 기간 범위 계산 — 월간: 전월, 주간/일간: 동일 길이 이전 기간 */
function getPrevPeriod(
  month?: string,
  startDate?: string,
  endDate?: string,
): { prevMonth?: string; prevStart?: string; prevEnd?: string } | null {
  // 월간 모드
  if (month && !startDate && !endDate) {
    const [y, m] = month.split("-").map(Number)
    const d = new Date(y, m - 2, 1) // 전월
    const pm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    return { prevMonth: pm }
  }
  // 주간/일간 모드
  if (startDate && endDate) {
    const s = new Date(startDate)
    const e = new Date(endDate)
    const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
    const ps = new Date(s)
    ps.setDate(ps.getDate() - (diffDays + 1))
    const pe = new Date(s)
    pe.setDate(pe.getDate() - 1)
    return {
      prevStart: ps.toISOString().slice(0, 10),
      prevEnd: pe.toISOString().slice(0, 10),
    }
  }
  return null
}

// ── fetch-all orchestrator (pure async, no React state) ─────────────

async function fetchAllProductivityData(
  month?: string,
  startDate?: string,
  endDate?: string,
  scope?: { center?: string; service?: string },
): Promise<ProductivityDataBundle> {
  const prev = getPrevPeriod(month, startDate, endDate)

  const fetches: Promise<unknown>[] = [
    fetchData<VoiceData>("productivity-voice", month, startDate, endDate, undefined, scope),
    fetchData<ProductivityProcessingTime[]>("productivity-voice-time", month, startDate, endDate, undefined, scope),
    fetchData<ProductivityDailyTrend[]>("productivity-voice-trend", month, startDate, endDate, undefined, scope),
    fetchData<ChatData>("productivity-chat", month, startDate, endDate, undefined, scope),
    fetchData<ProductivityDailyTrend[]>("productivity-chat-trend", month, startDate, endDate, undefined, scope),
    fetchData<BoardStats[]>("productivity-board", month, startDate, endDate, undefined, scope),
    fetchData<ForeignLangStats[]>("productivity-foreign", month, startDate, endDate, undefined, scope),
    fetchData<WeeklySummaryRow[]>("productivity-weekly-summary", undefined, undefined, undefined, { channel: "voice" }, scope),
    fetchData<WeeklySummaryRow[]>("productivity-weekly-summary", undefined, undefined, undefined, { channel: "chat" }, scope),
  ]

  // 이전 기간 비교 데이터
  if (prev) {
    const pm = prev.prevMonth
    const ps = prev.prevStart
    const pe = prev.prevEnd
    fetches.push(
      fetchData<VoiceData>("productivity-voice", pm, ps, pe, undefined, scope),
      fetchData<ProductivityProcessingTime[]>("productivity-voice-time", pm, ps, pe, undefined, scope),
      fetchData<ChatData>("productivity-chat", pm, ps, pe, undefined, scope),
    )
  }

  const results = await Promise.all(fetches)

  return {
    voiceData: (results[0] as VoiceData | null),
    voiceTime: (results[1] as ProductivityProcessingTime[] | null),
    voiceTrend: (results[2] as ProductivityDailyTrend[] | null),
    chatData: (results[3] as ChatData | null),
    chatTrend: (results[4] as ProductivityDailyTrend[] | null),
    boardData: (results[5] as BoardStats[] | null),
    foreignData: (results[6] as ForeignLangStats[] | null),
    voiceWeeklySummary: (results[7] as WeeklySummaryRow[] | null),
    chatWeeklySummary: (results[8] as WeeklySummaryRow[] | null),
    prevVoiceData: prev ? (results[9] as VoiceData | null) : null,
    prevVoiceTime: prev ? (results[10] as ProductivityProcessingTime[] | null) : null,
    prevChatData: prev ? (results[11] as ChatData | null) : null,
  }
}

// ── hook ─────────────────────────────────────────────────────────────

export function useProductivityData(
  month?: string,
  startDate?: string,
  endDate?: string,
  scope?: { center?: string; service?: string },
): UseProductivityDataReturn {
  const query = useQuery<ProductivityDataBundle>({
    queryKey: ["productivity-data", month, startDate, endDate, scope?.center, scope?.service],
    queryFn: () => fetchAllProductivityData(month, startDate, endDate, scope),
    enabled: !!(month || (startDate && endDate)),
  })

  const data = query.data

  return {
    voiceData: data?.voiceData ?? null,
    voiceTime: data?.voiceTime ?? null,
    voiceTrend: data?.voiceTrend ?? null,
    chatData: data?.chatData ?? null,
    chatTrend: data?.chatTrend ?? null,
    boardData: data?.boardData ?? null,
    foreignData: data?.foreignData ?? null,
    voiceWeeklySummary: data?.voiceWeeklySummary ?? null,
    chatWeeklySummary: data?.chatWeeklySummary ?? null,
    prevVoiceData: data?.prevVoiceData ?? null,
    prevVoiceTime: data?.prevVoiceTime ?? null,
    prevChatData: data?.prevChatData ?? null,
    loading: query.isLoading,
    error: query.error?.message || null,
    refetch: () => { query.refetch() },
  }
}
