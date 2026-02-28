"use client"

import { useState, useEffect, useCallback } from "react"

interface AgentDetailStats {
  agentId: string
  agentName: string
  totalEvaluations: number
  dailyTrend: Array<{
    date: string
    errorRate: number
    totalEvaluations: number
  }>
  itemErrors: Array<{
    itemId: string
    itemName: string
    errorCount: number
    category: "상담태도" | "오상담/오처리"
  }>
}

interface UseAgentDetailOptions {
  agentId: string
  startDate?: string
  endDate?: string
}

export function useAgentDetail(options: UseAgentDetailOptions) {
  const [data, setData] = useState<AgentDetailStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!options.agentId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      params.append("type", "agent-detail")
      params.append("agentId", options.agentId)
      if (options.startDate) params.append("startDate", options.startDate)
      if (options.endDate) params.append("endDate", options.endDate)

      const response = await fetch(`/api/data?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data || null)
      } else {
        setError(result.error || "데이터를 불러올 수 없습니다.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터 로딩 실패")
    } finally {
      setLoading(false)
    }
  }, [options.agentId, options.startDate, options.endDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
