"use client"

import { useState, useEffect, useCallback } from "react"

interface WeeklyErrorData {
  week: string
  weekLabel: string
  dateRange?: string
  totalEvaluations?: number
  items: Array<{
    itemId: string
    itemName: string
    errorCount: number
    errorRate: number
  }>
}

interface UseWeeklyErrorsOptions {
  startDate?: string
  endDate?: string
  center?: string
  service?: string
  channel?: string
}

export function useWeeklyErrors(options: UseWeeklyErrorsOptions = {}) {
  const [data, setData] = useState<WeeklyErrorData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (options.startDate) params.append("startDate", options.startDate)
      if (options.endDate) params.append("endDate", options.endDate)
      if (options.center) params.append("center", options.center)
      if (options.service) params.append("service", options.service)
      if (options.channel) params.append("channel", options.channel)
      params.append("type", "weekly-errors")

      const response = await fetch(`/api/data?${params.toString()}`)
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
  }, [options.startDate, options.endDate, options.center, options.service, options.channel])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
