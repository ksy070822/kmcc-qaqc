"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { CSATDashboardStats, CSATTrendData, CSATDailyRow, CSATWeeklyRow, CSATLowScoreWeekly, CSATTagRow } from "@/lib/types"

const API_BASE = "/api/data"

export function useCSATDashboardData(startDate?: string, endDate?: string) {
  const [stats, setStats] = useState<CSATDashboardStats | null>(null)
  const [trendData, setTrendData] = useState<CSATTrendData[]>([])
  const [dailyData, setDailyData] = useState<CSATDailyRow[]>([])
  const [weeklyData, setWeeklyData] = useState<CSATWeeklyRow[]>([])
  const [lowScoreData, setLowScoreData] = useState<CSATLowScoreWeekly[]>([])
  const [tagData, setTagData] = useState<CSATTagRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const hasFetched = useRef(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const dateParams = `${startDate ? `&startDate=${startDate}` : ""}${endDate ? `&endDate=${endDate}` : ""}`

      const [statsRes, trendRes, dailyRes, weeklyRes, lowScoreRes, tagRes] = await Promise.all([
        fetch(`${API_BASE}?type=csat-dashboard${dateParams}`),
        fetch(`${API_BASE}?type=csat-trend&days=30`),
        fetch(`${API_BASE}?type=csat-daily${dateParams}`),
        fetch(`${API_BASE}?type=csat-weekly`),
        fetch(`${API_BASE}?type=csat-low-score`),
        fetch(`${API_BASE}?type=csat-tags${dateParams}`),
      ])

      const [statsData, trendDataRes, dailyDataRes, weeklyDataRes, lowScoreDataRes, tagDataRes] = await Promise.all([
        statsRes.json(),
        trendRes.json(),
        dailyRes.json(),
        weeklyRes.json(),
        lowScoreRes.json(),
        tagRes.json(),
      ])

      if (statsData.success && statsData.data) {
        setStats(statsData.data)
      } else {
        console.warn("[CSAT Dashboard] Stats fetch failed:", statsData)
        if (statsData.error) setError(statsData.error)
      }

      if (trendDataRes.success && trendDataRes.data) {
        setTrendData(trendDataRes.data)
      } else {
        console.warn("[CSAT Dashboard] Trend fetch failed:", trendDataRes)
      }

      if (dailyDataRes.success && dailyDataRes.data) {
        setDailyData(dailyDataRes.data)
      } else {
        console.warn("[CSAT Dashboard] Daily fetch failed:", dailyDataRes)
      }

      if (weeklyDataRes.success && weeklyDataRes.data) {
        setWeeklyData(weeklyDataRes.data)
      } else {
        console.warn("[CSAT Dashboard] Weekly fetch failed:", weeklyDataRes)
      }

      if (lowScoreDataRes.success && lowScoreDataRes.data) {
        setLowScoreData(lowScoreDataRes.data)
      } else {
        console.warn("[CSAT Dashboard] LowScore fetch failed:", lowScoreDataRes)
      }

      if (tagDataRes.success && tagDataRes.data) {
        setTagData(tagDataRes.data)
      } else {
        console.warn("[CSAT Dashboard] Tag fetch failed:", tagDataRes)
      }
    } catch (err) {
      console.error("[CSAT Dashboard] Data fetch error:", err)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

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
  }, [startDate, endDate, mounted, fetchData])

  return {
    stats,
    trendData,
    dailyData,
    weeklyData,
    lowScoreData,
    tagData,
    loading: !mounted || loading,
    error,
    refresh: fetchData,
  }
}
