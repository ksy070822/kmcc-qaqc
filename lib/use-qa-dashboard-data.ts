"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { QADashboardStats, QACenterStats, QATrendData } from "@/lib/types"

const API_BASE = "/api/data"

export function useQADashboardData(startMonth?: string, endMonth?: string, scope?: { center?: string; service?: string }) {
  const [stats, setStats] = useState<QADashboardStats | null>(null)
  const [centerStats, setCenterStats] = useState<QACenterStats[]>([])
  const [trendData, setTrendData] = useState<QATrendData[]>([])
  const [underperformerCount, setUnderperformerCount] = useState<{ yongsan: number; gwangju: number; total: number }>({ yongsan: 0, gwangju: 0, total: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const hasFetched = useRef(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const monthParams = `${startMonth ? `&startMonth=${startMonth}` : ""}${endMonth ? `&endMonth=${endMonth}` : ""}`
      const scopeParams = `${scope?.center ? `&center=${encodeURIComponent(scope.center)}` : ""}${scope?.service ? `&service=${encodeURIComponent(scope.service)}` : ""}`

      const [statsRes, centersRes, trendRes, underRes] = await Promise.all([
        fetch(`${API_BASE}?type=qa-dashboard${monthParams}${scopeParams}`),
        fetch(`${API_BASE}?type=qa-centers${monthParams}${scopeParams}`),
        fetch(`${API_BASE}?type=qa-trend&months=6${scopeParams}`),
        fetch(`${API_BASE}?type=qa-underperformer-count${monthParams}${scopeParams}`),
      ])

      const [statsData, centersData, trendDataRes, underData] = await Promise.all([
        statsRes.json(),
        centersRes.json(),
        trendRes.json(),
        underRes.json(),
      ])

      if (statsData.success && statsData.data) {
        setStats(statsData.data)
      } else {
        console.warn("[QA Dashboard] Stats fetch failed:", statsData)
        if (statsData.error) setError(statsData.error)
      }

      if (centersData.success && centersData.data) {
        setCenterStats(centersData.data)
      } else {
        console.warn("[QA Dashboard] Centers fetch failed:", centersData)
      }

      if (trendDataRes.success && trendDataRes.data) {
        setTrendData(trendDataRes.data)
      } else {
        console.warn("[QA Dashboard] Trend fetch failed:", trendDataRes)
      }

      if (underData.success && underData.data) {
        setUnderperformerCount(underData.data)
      }
    } catch (err) {
      console.error("[QA Dashboard] Data fetch error:", err)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [startMonth, endMonth, scope?.center, scope?.service])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !hasFetched.current) {
      hasFetched.current = true
      fetchData()
    }
  }, [mounted, fetchData])

  useEffect(() => {
    if (mounted && hasFetched.current) {
      fetchData()
    }
  }, [startMonth, endMonth, mounted, fetchData])

  return {
    stats,
    centerStats,
    trendData,
    underperformerCount,
    loading: !mounted || loading,
    error,
    refresh: fetchData,
  }
}
