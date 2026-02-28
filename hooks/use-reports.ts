"use client"

import { useState, useCallback } from "react"

export interface ReportConfig {
  type: "weekly" | "monthly" | "quarterly" | "halfYear" | "yearly" | "custom"
  period: string
  center?: string
  service?: string
  channel?: string
  startDate?: string
  endDate?: string
}

export interface ReportData {
  type: string
  period: string
  center: string
  title?: string
  summary: {
    totalEvaluations: number
    totalAgents: number
    overallErrorRate: number
    attitudeErrorRate: number
    processErrorRate: number
    errorRateTrend: number
  }
  topIssues: Array<{
    name: string
    count: number
    rate: number
  }>
  centerComparison: Array<{
    name: string
    errorRate: number
    agents: number
  }>
  dailyTrend: Array<{
    date: string
    errorRate: number
    target: number
  }>
  groupRanking: Array<{
    group: string
    center: string
    errorRate: number
    trend: number
  }>
  /** Generic data array for CSV export */
  data?: Array<Record<string, unknown>>
}

export function useReports() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateReport = useCallback(async (config: ReportConfig): Promise<ReportData | null> => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      })

      const result = await response.json()

      if (result.success && result.data) {
        return result.data
      } else {
        setError(result.error || "리포트 생성에 실패했습니다.")
        return null
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "리포트 생성 실패"
      setError(errorMessage)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { generateReport, loading, error }
}
