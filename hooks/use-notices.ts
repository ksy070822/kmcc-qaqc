"use client"

import { useState, useEffect, useCallback } from "react"
import type { NoticeListResponse } from "@/lib/types"

export function useNotices(agentId: string | null, center: string | null, type?: string) {
  const [data, setData] = useState<NoticeListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNotices = useCallback(async () => {
    if (!agentId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ agentId })
      if (center) params.set("center", center)
      if (type && type !== "all") params.set("type", type)
      const res = await fetch(`/api/mypage/notices?${params}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      } else {
        console.error("[useNotices] API error:", json.error)
        setError(json.error || "공지 조회 실패")
      }
    } catch (e) {
      console.error("[useNotices] fetch error:", e)
      setError(e instanceof Error ? e.message : "네트워크 오류")
    } finally {
      setLoading(false)
    }
  }, [agentId, center, type])

  useEffect(() => { fetchNotices() }, [fetchNotices])

  return { data, loading, error, refetch: fetchNotices }
}

export function useUnreadNoticeCount(agentId: string | null, center: string | null) {
  const [count, setCount] = useState(0)

  const fetchCount = useCallback(async () => {
    if (!agentId) return
    try {
      const params = new URLSearchParams({ agentId, countOnly: "true" })
      if (center) params.set("center", center)
      const res = await fetch(`/api/mypage/notices?${params}`)
      const json = await res.json()
      if (json.success) setCount(json.data?.unreadCount ?? 0)
    } catch {
      // silent
    }
  }, [agentId, center])

  useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, 15 * 60 * 1000) // 15분 간격 (배터리 절약)
    // 탭 포커스 시 즉시 갱신
    const onFocus = () => fetchCount()
    window.addEventListener("focus", onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener("focus", onFocus)
    }
  }, [fetchCount])

  return { count, refetch: fetchCount }
}
