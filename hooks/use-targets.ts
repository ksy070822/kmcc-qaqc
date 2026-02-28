"use client"

import { useState, useEffect, useCallback } from "react"
import type { MultiDomainTarget, TargetDomain } from "@/lib/types"

interface UseTargetsOptions {
  domain?: TargetDomain
  year?: number
  center?: string
}

export function useTargets(options: UseTargetsOptions = {}) {
  const [data, setData] = useState<MultiDomainTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchTargets = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (options.domain) params.append("domain", options.domain)
      if (options.year) params.append("year", String(options.year))
      if (options.center && options.center !== "all") params.append("center", options.center)

      const response = await fetch(`/api/targets?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data || [])
      } else {
        // API가 아직 없으면 빈 배열로 처리
        setData([])
      }
    } catch {
      // API 미구현 시 빈 배열 반환 (Phase 2에서 API 연동)
      setData([])
    } finally {
      setLoading(false)
    }
  }, [options.domain, options.year, options.center])

  useEffect(() => {
    fetchTargets()
  }, [fetchTargets])

  const saveTarget = useCallback(async (target: MultiDomainTarget) => {
    try {
      setSaving(true)
      setError(null)

      const isUpdate = !!target.targetId
      const response = await fetch("/api/targets", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target),
      })

      const result = await response.json()

      if (result.success) {
        await fetchTargets()
        return true
      } else {
        setError(result.error || "저장에 실패했습니다.")
        return false
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 중 오류 발생")
      return false
    } finally {
      setSaving(false)
    }
  }, [fetchTargets])

  return { data, loading, error, refetch: fetchTargets, saveTarget, saving }
}
