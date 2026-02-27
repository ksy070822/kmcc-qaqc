"use client"

import { useState, useEffect, useCallback } from "react"
import type { NoticeListResponse } from "@/lib/types"

export function useNotices(agentId: string | null, center: string | null, type?: string) {
  const [data, setData] = useState<NoticeListResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchNotices = useCallback(async () => {
    if (!agentId || !center) { setLoading(false); return }
    setLoading(true)
    try {
      const params = new URLSearchParams({ agentId, center })
      if (type && type !== "all") params.set("type", type)
      const res = await fetch(`/api/mypage/notices?${params}`)
      const json = await res.json()
      if (json.success) setData(json.data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [agentId, center, type])

  useEffect(() => { fetchNotices() }, [fetchNotices])

  return { data, loading, refetch: fetchNotices }
}

export function useUnreadNoticeCount(agentId: string | null, center: string | null) {
  const [count, setCount] = useState(0)

  const fetchCount = useCallback(async () => {
    if (!agentId || !center) return
    try {
      const params = new URLSearchParams({ agentId, center, countOnly: "true" })
      const res = await fetch(`/api/mypage/notices?${params}`)
      const json = await res.json()
      if (json.success) setCount(json.data?.unreadCount ?? 0)
    } catch {
      // silent
    }
  }, [agentId, center])

  useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, 5 * 60 * 1000) // 5분 간격
    return () => clearInterval(interval)
  }, [fetchCount])

  return { count, refetch: fetchCount }
}
