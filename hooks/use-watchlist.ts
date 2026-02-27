"use client"

import { useState, useEffect, useCallback } from "react"

export interface WatchListAgent {
  agentId: string
  agentName: string
  center: string
  service: string
  channel: string
  tenureMonths: number
  tenureGroup: string
  attitudeRate: number
  opsRate: number
  totalRate: number
  trend: number
  evaluationCount: number
  reason: string
  topErrors: string[]
  registeredAt?: string
  weeklyStatus?: "new" | "continuing" | "resolving"
}

interface UseWatchListOptions {
  center?: string
  channel?: string
  tenure?: string
  month?: string
  weekStart?: string
  weekEnd?: string
}

export function useWatchList(options: UseWatchListOptions = {}) {
  const [data, setData] = useState<WatchListAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWatchList = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (options.center && options.center !== "all") params.append("center", options.center)
      if (options.channel && options.channel !== "all") params.append("channel", options.channel)
      if (options.tenure && options.tenure !== "all") params.append("tenure", options.tenure)
      if (options.month) params.append("month", options.month)
      if (options.weekStart) params.append("weekStart", options.weekStart)
      if (options.weekEnd) params.append("weekEnd", options.weekEnd)

      const response = await fetch(`/api/watchlist?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data || [])
      } else {
        setError(result.error || "데이터를 불러올 수 없습니다.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터 로딩 실패")
    } finally {
      setLoading(false)
    }
  }, [options.center, options.channel, options.tenure, options.month, options.weekStart, options.weekEnd])

  useEffect(() => {
    fetchWatchList()
  }, [fetchWatchList])

  return { data, loading, error, refetch: fetchWatchList }
}
