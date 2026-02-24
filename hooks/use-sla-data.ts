"use client"

import { useState, useEffect, useCallback } from "react"
import type { SLAResult } from "@/lib/types"

interface UseSLADataReturn {
  scorecard: SLAResult[] | null
  trend: SLAResult[] | null
  loading: boolean
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

export function useSLAData(month?: string, startDate?: string, endDate?: string): UseSLADataReturn {
  const [scorecard, setScorecard] = useState<SLAResult[] | null>(null)
  const [trend, setTrend] = useState<SLAResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sc, tr] = await Promise.all([
        fetchSLA<SLAResult[]>("sla-scorecard", month, startDate, endDate),
        fetchSLA<SLAResult[]>("sla-trend"),
      ])
      setScorecard(sc)
      setTrend(tr)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [month, startDate, endDate])

  useEffect(() => {
    if (month || (startDate && endDate)) fetchAll()
  }, [month, startDate, endDate, fetchAll])

  return { scorecard, trend, loading, error, refetch: fetchAll }
}
