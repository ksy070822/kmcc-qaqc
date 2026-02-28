"use client"

import { useState, useEffect, useCallback } from "react"

import type { PredictionApiData } from "@/lib/types"

type PredictionData = PredictionApiData

interface UsePredictionsOptions {
  month?: string
  center?: string
}

export function usePredictions(options: UsePredictionsOptions = {}) {
  const [data, setData] = useState<PredictionData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (options.month) params.append("month", options.month)
      if (options.center) params.append("center", options.center)

      const response = await fetch(`/api/predictions?${params.toString()}`)
      const result = await response.json()

      if (result.success && result.data) {
        setData(result.data.predictions || [])
      } else {
        setError(result.error || "데이터를 불러올 수 없습니다.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터 로딩 실패")
    } finally {
      setLoading(false)
    }
  }, [options.month, options.center])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
