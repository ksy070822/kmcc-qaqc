"use client"

import { useState, useEffect, useCallback } from "react"
import type { MypageQCDetail } from "@/lib/types"

export function useMypageQCDetail(agentId: string | null, month?: string) {
  const [data, setData] = useState<MypageQCDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    if (!agentId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ agentId })
      if (month) params.set("month", month)
      const res = await fetch(`/api/mypage/qc-detail?${params}`)
      const json = await res.json()
      if (json.success) setData(json.data)
      else setError(json.error || "Failed")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [agentId, month])

  useEffect(() => { fetch_() }, [fetch_])
  return { data, loading, error, refetch: fetch_ }
}
