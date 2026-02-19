"use client"

import { useState, useEffect, useCallback } from "react"
import type { WeeklyReportItem, WeeklyReportInput } from "@/lib/types"

interface UseWeeklyReportsOptions {
  center?: string
  service?: string
  week?: string
  status?: string
  enabled?: boolean
}

export function useWeeklyReports(options: UseWeeklyReportsOptions = {}) {
  const [data, setData] = useState<WeeklyReportItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (options.enabled === false) return

    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (options.center && options.center !== "all") params.append("center", options.center)
      if (options.service && options.service !== "all") params.append("service", options.service)
      if (options.week) params.append("week", options.week)
      if (options.status) params.append("status", options.status)

      const response = await fetch(`/api/weekly-reports?${params.toString()}`)
      const result = await response.json()

      if (result.success && result.data) {
        setData(result.data.reports || [])
      } else {
        setError(result.error || "주간보고 데이터를 불러올 수 없습니다.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "주간보고 로딩 실패")
    } finally {
      setLoading(false)
    }
  }, [options.center, options.service, options.week, options.status, options.enabled])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const saveReport = useCallback(async (report: WeeklyReportInput): Promise<{
    success: boolean
    reportId?: string
    registeredAgents?: string[]
    error?: string
  }> => {
    try {
      const method = report.reportId ? "PUT" : "POST"
      const response = await fetch("/api/weekly-reports", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      })
      const result = await response.json()

      if (result.success) {
        await fetchData()
      }

      return result
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "저장 실패",
      }
    }
  }, [fetchData])

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    saveReport,
  }
}
