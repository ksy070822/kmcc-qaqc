"use client"

import { useState, useEffect, useCallback } from "react"
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

function buildQuery(type: string, month?: string, startDate?: string, endDate?: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ type })
  if (startDate && endDate) {
    params.set("startDate", startDate)
    params.set("endDate", endDate)
  } else if (month) {
    params.set("month", month)
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) params.set(k, v)
  }
  return `/api/data?${params}`
}

async function fetchData<T>(type: string, month?: string, startDate?: string, endDate?: string, extra?: Record<string, string>): Promise<T | null> {
  try {
    const res = await fetch(buildQuery(type, month, startDate, endDate, extra))
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
function getPrevPeriod(month?: string, startDate?: string, endDate?: string): { prevMonth?: string; prevStart?: string; prevEnd?: string } | null {
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

export function useProductivityData(
  month?: string,
  startDate?: string,
  endDate?: string,
): UseProductivityDataReturn {
  const [voiceData, setVoiceData] = useState<VoiceData | null>(null)
  const [voiceTime, setVoiceTime] = useState<ProductivityProcessingTime[] | null>(null)
  const [voiceTrend, setVoiceTrend] = useState<ProductivityDailyTrend[] | null>(null)
  const [chatData, setChatData] = useState<ChatData | null>(null)
  const [chatTrend, setChatTrend] = useState<ProductivityDailyTrend[] | null>(null)
  const [boardData, setBoardData] = useState<BoardStats[] | null>(null)
  const [foreignData, setForeignData] = useState<ForeignLangStats[] | null>(null)
  const [voiceWeeklySummary, setVoiceWeeklySummary] = useState<WeeklySummaryRow[] | null>(null)
  const [chatWeeklySummary, setChatWeeklySummary] = useState<WeeklySummaryRow[] | null>(null)
  const [prevVoiceData, setPrevVoiceData] = useState<VoiceData | null>(null)
  const [prevVoiceTime, setPrevVoiceTime] = useState<ProductivityProcessingTime[] | null>(null)
  const [prevChatData, setPrevChatData] = useState<ChatData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 이전 기간 범위 (월간: 전월, 주간: 전주)
      const prev = getPrevPeriod(month, startDate, endDate)

      const fetches: Promise<unknown>[] = [
        fetchData<VoiceData>("productivity-voice", month, startDate, endDate),
        fetchData<ProductivityProcessingTime[]>("productivity-voice-time", month, startDate, endDate),
        fetchData<ProductivityDailyTrend[]>("productivity-voice-trend", month, startDate, endDate),
        fetchData<ChatData>("productivity-chat", month, startDate, endDate),
        fetchData<ProductivityDailyTrend[]>("productivity-chat-trend", month, startDate, endDate),
        fetchData<BoardStats[]>("productivity-board", month, startDate, endDate),
        fetchData<ForeignLangStats[]>("productivity-foreign", month, startDate, endDate),
        fetchData<WeeklySummaryRow[]>("productivity-weekly-summary", undefined, undefined, undefined, { channel: "voice" }),
        fetchData<WeeklySummaryRow[]>("productivity-weekly-summary", undefined, undefined, undefined, { channel: "chat" }),
      ]

      // 이전 기간 비교 데이터
      if (prev) {
        const pm = prev.prevMonth
        const ps = prev.prevStart
        const pe = prev.prevEnd
        fetches.push(
          fetchData<VoiceData>("productivity-voice", pm, ps, pe),
          fetchData<ProductivityProcessingTime[]>("productivity-voice-time", pm, ps, pe),
          fetchData<ChatData>("productivity-chat", pm, ps, pe),
        )
      }

      const results = await Promise.all(fetches)

      setVoiceData(results[0] as VoiceData | null)
      setVoiceTime(results[1] as ProductivityProcessingTime[] | null)
      setVoiceTrend(results[2] as ProductivityDailyTrend[] | null)
      setChatData(results[3] as ChatData | null)
      setChatTrend(results[4] as ProductivityDailyTrend[] | null)
      setBoardData(results[5] as BoardStats[] | null)
      setForeignData(results[6] as ForeignLangStats[] | null)
      setVoiceWeeklySummary(results[7] as WeeklySummaryRow[] | null)
      setChatWeeklySummary(results[8] as WeeklySummaryRow[] | null)

      if (prev) {
        setPrevVoiceData(results[9] as VoiceData | null)
        setPrevVoiceTime(results[10] as ProductivityProcessingTime[] | null)
        setPrevChatData(results[11] as ChatData | null)
      } else {
        setPrevVoiceData(null)
        setPrevVoiceTime(null)
        setPrevChatData(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [month, startDate, endDate])

  useEffect(() => {
    if (month || (startDate && endDate)) fetchAll()
  }, [month, startDate, endDate, fetchAll])

  return {
    voiceData,
    voiceTime,
    voiceTrend,
    chatData,
    chatTrend,
    boardData,
    foreignData,
    voiceWeeklySummary,
    chatWeeklySummary,
    prevVoiceData,
    prevVoiceTime,
    prevChatData,
    loading,
    error,
    refetch: fetchAll,
  }
}
