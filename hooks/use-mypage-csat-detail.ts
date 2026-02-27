"use client"

import { useState, useEffect, useCallback } from "react"
import type { MypageCSATDetail } from "@/lib/types"

export function useMypageCSATDetail(
  agentId: string | null,
  month?: string,
  period: "weekly" | "monthly" = "monthly",
  weekOffset: number = 0,
) {
  const [data, setData] = useState<MypageCSATDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    if (!agentId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ agentId, period })
      if (month) params.set("month", month)
      if (period === "weekly") params.set("weekOffset", String(weekOffset))
      const res = await fetch(`/api/mypage/csat-detail?${params}`)
      const json = await res.json()
      if (json.success) setData(json.data)
      else setError(json.error || "Failed")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [agentId, month, period, weekOffset])

  useEffect(() => { fetch_() }, [fetch_])
  return { data, loading, error, refetch: fetch_ }
}
