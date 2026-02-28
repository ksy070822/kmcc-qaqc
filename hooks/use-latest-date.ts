"use client"

import { useState, useEffect, useCallback } from "react"

let cachedLatestDate: string | null = null
let cacheTimestamp = 0
const CACHE_TTL = 5 * 60 * 1000 // 5분

export function useLatestDate() {
  const [latestDate, setLatestDate] = useState<string | null>(cachedLatestDate)
  const [loading, setLoading] = useState(!cachedLatestDate)

  const fetchDate = useCallback(async () => {
    // 캐시가 유효하면 바로 반환
    if (cachedLatestDate && Date.now() - cacheTimestamp < CACHE_TTL) {
      setLatestDate(cachedLatestDate)
      setLoading(false)
      return cachedLatestDate
    }

    try {
      setLoading(true)
      const res = await fetch("/api/data?type=latest-date")
      const data = await res.json()
      const date = data.success && data.latestDate
        ? data.latestDate
        : new Date().toISOString().slice(0, 10)

      cachedLatestDate = date
      cacheTimestamp = Date.now()
      setLatestDate(date)
      return date
    } catch {
      const fallback = new Date().toISOString().slice(0, 10)
      setLatestDate(fallback)
      return fallback
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDate()
  }, [fetchDate])

  return { latestDate, loading, refetch: fetchDate }
}
