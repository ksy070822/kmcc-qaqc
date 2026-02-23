"use client"

import { useState, useEffect, useCallback } from "react"
import type { HrAgent } from "@/lib/types"

export function useAgentList(center?: string) {
  const [data, setData] = useState<HrAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (center) params.set("center", center)
      const res = await fetch(`/api/mypage/agents?${params.toString()}`)
      const json = await res.json()
      if (json.success) setData(json.data)
      else setError(json.error || "Failed")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [center])

  useEffect(() => { fetch_() }, [fetch_])
  return { data, loading, error, refetch: fetch_ }
}
