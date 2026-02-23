"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { QuizDashboardStats, QuizTrendData, QuizAgentRow, QuizServiceTrendRow } from "@/lib/types"

const API_BASE = "/api/data"

export function useQuizDashboardData(startMonth?: string, endMonth?: string, center?: string) {
  const [stats, setStats] = useState<QuizDashboardStats | null>(null)
  const [trendData, setTrendData] = useState<QuizTrendData[]>([])
  const [agentData, setAgentData] = useState<QuizAgentRow[]>([])
  const [serviceTrendData, setServiceTrendData] = useState<QuizServiceTrendRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const hasFetched = useRef(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const monthParams = `${startMonth ? `&startMonth=${startMonth}` : ""}${endMonth ? `&endMonth=${endMonth}` : ""}`
      const centerParam = center && center !== "all" ? `&center=${center}` : ""

      const [statsRes, trendRes, agentRes, svcTrendRes] = await Promise.all([
        fetch(`${API_BASE}?type=quiz-dashboard${monthParams}`),
        fetch(`${API_BASE}?type=quiz-trend&months=6`),
        fetch(`${API_BASE}?type=quiz-agents${monthParams}${centerParam}`),
        fetch(`${API_BASE}?type=quiz-service-trend${centerParam}&months=6`),
      ])

      const [statsData, trendDataRes, agentDataRes, svcTrendDataRes] = await Promise.all([
        statsRes.json(),
        trendRes.json(),
        agentRes.json(),
        svcTrendRes.json(),
      ])

      if (statsData.success && statsData.data) {
        setStats(statsData.data)
      } else {
        console.warn("[Quiz Dashboard] Stats fetch failed:", statsData)
        if (statsData.error) setError(statsData.error)
      }

      if (trendDataRes.success && trendDataRes.data) {
        setTrendData(trendDataRes.data)
      } else {
        console.warn("[Quiz Dashboard] Trend fetch failed:", trendDataRes)
      }

      if (agentDataRes.success && agentDataRes.data) {
        setAgentData(agentDataRes.data)
      } else {
        console.warn("[Quiz Dashboard] Agent fetch failed:", agentDataRes)
      }

      if (svcTrendDataRes.success && svcTrendDataRes.data) {
        setServiceTrendData(svcTrendDataRes.data)
      } else {
        console.warn("[Quiz Dashboard] Service trend fetch failed:", svcTrendDataRes)
      }
    } catch (err) {
      console.error("[Quiz Dashboard] Data fetch error:", err)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [startMonth, endMonth, center])

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
  }, [startMonth, endMonth, center, mounted, fetchData])

  return {
    stats,
    trendData,
    agentData,
    serviceTrendData,
    loading: !mounted || loading,
    error,
    refresh: fetchData,
  }
}
