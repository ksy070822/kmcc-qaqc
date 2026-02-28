"use client"

import { useState, useCallback } from "react"
import type { PredictionApiData } from "@/lib/types"

interface CenterSummaryEntry {
  attitude: { current: number; predicted: number; target: number; prob: number }
  process: { current: number; predicted: number; target: number; prob: number }
}

interface UsePredictionAIReturn {
  analysis: string | null
  loading: boolean
  error: string | null
  generateAnalysis: (
    center: string | undefined,
    predictions: PredictionApiData[],
    centerSummary: Record<string, CenterSummaryEntry>
  ) => Promise<void>
}

export function usePredictionAI(): UsePredictionAIReturn {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateAnalysis = useCallback(async (
    center: string | undefined,
    predictions: PredictionApiData[],
    centerSummary: Record<string, CenterSummaryEntry>
  ) => {
    try {
      setLoading(true)
      setError(null)
      setAnalysis(null)

      const response = await fetch("/api/ai/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ center, predictions, centerSummary }),
      })

      const result = await response.json()

      if (result.success && result.analysis) {
        setAnalysis(result.analysis)
      } else {
        setError(result.error || "AI 분석 생성에 실패했습니다.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 분석 요청 실패")
    } finally {
      setLoading(false)
    }
  }, [])

  return { analysis, loading, error, generateAnalysis }
}
