"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { SLAResult } from "@/lib/types"

type SLATab = "scorecard" | "detail" | "simulator" | "trend" | "progress"

interface UseSLADataReturn {
  scorecard: SLAResult[] | null
  trend: SLAResult[] | null
  loading: boolean
  trendLoading: boolean
  error: string | null
  refetch: () => void
}

async function fetchSLA<T>(type: string, month?: string, startDate?: string, endDate?: string): Promise<T | null> {
  try {
    const params = new URLSearchParams({ type })
    if (startDate && endDate) {
      params.set("startDate", startDate)
      params.set("endDate", endDate)
    } else if (month) {
      params.set("month", month)
    }
    const res = await fetch(`/api/data?${params}`)
    const json = await res.json()
    if (json.success && json.data) return json.data as T
    console.error(`[SLA] ${type} error:`, json.error)
    return null
  } catch (err) {
    console.error(`[SLA] ${type} fetch error:`, err)
    return null
  }
}

export function useSLAData(month?: string, startDate?: string, endDate?: string, activeTab?: SLATab): UseSLADataReturn {
  const [scorecard, setScorecard] = useState<SLAResult[] | null>(null)
  const [trend, setTrend] = useState<SLAResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [trendLoading, setTrendLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trendFetched = useRef(false)

  // 스코어카드 fetch (기본 — 모든 탭에서 필요)
  const fetchScorecard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sc = await fetchSLA<SLAResult[]>("sla-scorecard", month, startDate, endDate)
      setScorecard(sc)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [month, startDate, endDate])

  // 트렌드 fetch (lazy — trend 탭 진입 시에만)
  const fetchTrend = useCallback(async () => {
    if (trendFetched.current) return
    setTrendLoading(true)
    try {
      const tr = await fetchSLA<SLAResult[]>("sla-trend")
      setTrend(tr)
      trendFetched.current = true
    } catch (err) {
      console.error("[SLA] trend fetch error:", err)
    } finally {
      setTrendLoading(false)
    }
  }, [])

  // 월/기간 변경 시 스코어카드만 즉시 로드
  useEffect(() => {
    if (month || (startDate && endDate)) {
      trendFetched.current = false
      setTrend(null)
      fetchScorecard()
    }
  }, [month, startDate, endDate, fetchScorecard])

  // trend 탭 진입 시 트렌드 레이지 로드
  useEffect(() => {
    if (activeTab === "trend" && !trendFetched.current) {
      fetchTrend()
    }
  }, [activeTab, fetchTrend])

  const refetch = useCallback(() => {
    trendFetched.current = false
    setTrend(null)
    fetchScorecard()
    if (activeTab === "trend") fetchTrend()
  }, [fetchScorecard, fetchTrend, activeTab])

  return { scorecard, trend, loading, trendLoading, error, refetch }
}
