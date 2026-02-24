"use client"

import { useState, useEffect, useCallback } from "react"
import type { SLADailyTrackingData } from "@/lib/types"

export interface UseSLADailyTrackingReturn {
  data: SLADailyTrackingData[] | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useSLADailyTracking(month?: string): UseSLADailyTrackingReturn {
  const [data, setData] = useState<SLADailyTrackingData[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ type: "sla-daily-tracking" })
      if (month) params.set("month", month)
      const res = await fetch(`/api/data?${params}`)
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data as SLADailyTrackingData[])
      } else {
        setError(json.error || "SLA 데일리 데이터를 불러올 수 없습니다")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
