"use client"

import { useState, useEffect, useCallback } from "react"

export interface CenterQualityMetrics {
  qaScore: number
  csatScore: number
  quizScore: number
  qcAttitudeRate: number
  qcProcessRate: number
}

export interface QualityMetrics {
  qaScore: number
  csatScore: number
  quizScore: number
  qcAttitudeRate: number
  qcProcessRate: number
  centers: Record<"용산" | "광주", CenterQualityMetrics>
}

const DEFAULT_CENTER: CenterQualityMetrics = {
  qaScore: 87,
  csatScore: 4.7,
  quizScore: 90,
  qcAttitudeRate: 3.0,
  qcProcessRate: 3.0,
}

const DEFAULT_METRICS: QualityMetrics = {
  ...DEFAULT_CENTER,
  centers: {
    "용산": { ...DEFAULT_CENTER },
    "광주": { ...DEFAULT_CENTER },
  },
}

export function useQualitySimulation() {
  const [metrics, setMetrics] = useState<QualityMetrics>(DEFAULT_METRICS)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const currentMonth = new Date().toISOString().slice(0, 7)

      const [qaRes, csatRes, predRes] = await Promise.allSettled([
        fetch(`/api/data?type=qa-dashboard&startMonth=${currentMonth}&endMonth=${currentMonth}`).then(r => r.json()),
        fetch(`/api/data?type=csat-dashboard`).then(r => r.json()),
        fetch(`/api/predictions?month=${currentMonth}`).then(r => r.json()),
      ])

      const centerData: QualityMetrics["centers"] = {
        "용산": { ...DEFAULT_CENTER },
        "광주": { ...DEFAULT_CENTER },
      }

      // QA scores by center
      if (qaRes.status === "fulfilled" && qaRes.value?.success) {
        const qaData = qaRes.value.data
        if (qaData?.centerStats) {
          for (const stat of qaData.centerStats) {
            const center = stat.center as "용산" | "광주"
            if (center in centerData && typeof stat.avgScore === "number") {
              centerData[center].qaScore = stat.avgScore
            }
          }
        } else if (typeof qaData?.avgScore === "number") {
          centerData["용산"].qaScore = qaData.avgScore
          centerData["광주"].qaScore = qaData.avgScore
        }
      }

      // CSAT scores by center
      if (csatRes.status === "fulfilled" && csatRes.value?.success) {
        const csatData = csatRes.value.data
        if (csatData?.centerStats) {
          for (const stat of csatData.centerStats) {
            const center = stat.center as "용산" | "광주"
            if (center in centerData && typeof stat.avgScore === "number") {
              centerData[center].csatScore = stat.avgScore
            }
          }
        } else if (typeof csatData?.avgScore === "number") {
          centerData["용산"].csatScore = csatData.avgScore
          centerData["광주"].csatScore = csatData.avgScore
        }
      }

      // QC error rates from predictions
      if (predRes.status === "fulfilled" && predRes.value?.success) {
        const predictions = predRes.value.data?.predictions || []
        const agg: Record<string, { attSum: number; opsSum: number; count: number }> = {}
        for (const p of predictions) {
          if (!agg[p.center]) agg[p.center] = { attSum: 0, opsSum: 0, count: 0 }
          agg[p.center].attSum += p.currentAttitudeRate
          agg[p.center].opsSum += p.currentOpsRate
          agg[p.center].count++
        }
        for (const [center, data] of Object.entries(agg)) {
          if (center in centerData && data.count > 0) {
            const c = center as "용산" | "광주"
            centerData[c].qcAttitudeRate = Number((data.attSum / data.count).toFixed(2))
            centerData[c].qcProcessRate = Number((data.opsSum / data.count).toFixed(2))
          }
        }
      }

      // Aggregate totals (average of both centers)
      const centers = Object.values(centerData)
      const len = centers.length
      setMetrics({
        qaScore: Number((centers.reduce((s, c) => s + c.qaScore, 0) / len).toFixed(1)),
        csatScore: Number((centers.reduce((s, c) => s + c.csatScore, 0) / len).toFixed(2)),
        quizScore: Number((centers.reduce((s, c) => s + c.quizScore, 0) / len).toFixed(1)),
        qcAttitudeRate: Number((centers.reduce((s, c) => s + c.qcAttitudeRate, 0) / len).toFixed(2)),
        qcProcessRate: Number((centers.reduce((s, c) => s + c.qcProcessRate, 0) / len).toFixed(2)),
        centers: centerData,
      })
    } catch {
      setMetrics(DEFAULT_METRICS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { metrics, loading }
}
