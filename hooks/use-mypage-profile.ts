"use client"

import { useState, useEffect, useCallback } from "react"
import type { MypageProfile } from "@/lib/types"

export function useMypageProfile(agentId: string | null) {
  const [data, setData] = useState<MypageProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    if (!agentId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/mypage/profile?agentId=${encodeURIComponent(agentId)}`)
      const json = await res.json()
      if (json.success) setData(json.data)
      else setError(json.error || "Failed")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => { fetch_() }, [fetch_])
  return { data, loading, error, refetch: fetch_ }
}
