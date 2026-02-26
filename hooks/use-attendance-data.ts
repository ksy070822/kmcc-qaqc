"use client"

import { useState, useEffect, useCallback } from "react"
import type { AttendanceOverview, AttendanceDetail, AttendanceDailyTrend, AgentAbsence } from "@/lib/types"

interface UseAttendanceDataReturn {
  overview: AttendanceOverview[] | null
  detail: AttendanceDetail[] | null
  trend: AttendanceDailyTrend[] | null
  agents: AgentAbsence[] | null
  loading: boolean
  error: string | null
  refetch: () => void
}

async function fetchAttendance<T>(type: string, params: Record<string, string>): Promise<T | null> {
  try {
    const sp = new URLSearchParams({ type, ...params })
    const res = await fetch(`/api/data?${sp}`)
    const json = await res.json()
    if (json.success && json.data) return json.data as T
    console.error(`[Attendance] ${type} error:`, json.error)
    return null
  } catch (err) {
    console.error(`[Attendance] ${type} fetch error:`, err)
    return null
  }
}

export function useAttendanceData(date: string): UseAttendanceDataReturn {
  const [overview, setOverview] = useState<AttendanceOverview[] | null>(null)
  const [detail, setDetail] = useState<AttendanceDetail[] | null>(null)
  const [trend, setTrend] = useState<AttendanceDailyTrend[] | null>(null)
  const [agents, setAgents] = useState<AgentAbsence[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!date) return
    setLoading(true)
    setError(null)
    try {
      // 7일 전 계산 (차트용 트렌드)
      const d = new Date(date)
      d.setDate(d.getDate() - 6)
      const trendStart = d.toISOString().slice(0, 10)

      // 3개월 전 계산 (상담사 미출근 현황)
      const d3 = new Date(date)
      d3.setMonth(d3.getMonth() - 3)
      const agentStart = d3.toISOString().slice(0, 10)

      const [ov, dt, tr, ag] = await Promise.all([
        fetchAttendance<AttendanceOverview[]>("attendance-overview", { date }),
        fetchAttendance<AttendanceDetail[]>("attendance-detail", { date }),
        fetchAttendance<AttendanceDailyTrend[]>("attendance-trend", { startDate: trendStart, endDate: date }),
        fetchAttendance<AgentAbsence[]>("attendance-agents", { startDate: agentStart, endDate: date }),
      ])
      setOverview(ov)
      setDetail(dt)
      setTrend(tr)
      setAgents(ag)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    if (date) fetchAll()
  }, [date, fetchAll])

  return { overview, detail, trend, agents, loading, error, refetch: fetchAll }
}
