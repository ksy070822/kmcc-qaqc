"use client"

import { useState, useEffect, useCallback } from "react"

export interface Goal {
  id: string
  name: string
  center: string | null
  type: string
  targetRate: number
  periodType: string
  periodStart: string
  periodEnd: string
  isActive: boolean
  service?: string | null
  channel?: string | null
}

interface UseGoalsOptions {
  center?: string
  periodType?: string
  isActive?: boolean
}

export function useGoals(options: UseGoalsOptions = {}) {
  const [data, setData] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGoals = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (options.center && options.center !== "all") params.append("center", options.center)
      if (options.periodType) params.append("periodType", options.periodType)
      if (options.isActive !== undefined) params.append("isActive", String(options.isActive))

      const response = await fetch(`/api/goals?${params.toString()}`)
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
  }, [options.center, options.periodType, options.isActive])

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  return { data, loading, error, refetch: fetchGoals }
}
