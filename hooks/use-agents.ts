"use client"

import { useState, useEffect, useCallback } from "react"

export interface Agent {
  id: string
  name: string
  center: string
  service: string
  channel: string
  tenureMonths: number
  tenureGroup: string
  isActive: boolean
  totalEvaluations: number
  attitudeErrorRate: number
  opsErrorRate: number
  overallErrorRate: number
}

interface UseAgentsOptions {
  center?: string
  service?: string
  channel?: string
  tenure?: string
  month?: string
}

export function useAgents(options: UseAgentsOptions = {}) {
  const [data, setData] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (options.center && options.center !== "all") params.append("center", options.center)
      if (options.service && options.service !== "all") params.append("service", options.service)
      if (options.channel && options.channel !== "all") params.append("channel", options.channel)
      if (options.tenure && options.tenure !== "all") params.append("tenure", options.tenure)
      if (options.month) params.append("month", options.month)

      const response = await fetch(`/api/agents?${params.toString()}`)
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
  }, [options.center, options.service, options.channel, options.tenure, options.month])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  return { data, loading, error, refetch: fetchAgents }
}
