"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { getUser, clearAuth, type UserInfo } from "@/lib/auth"

/**
 * 인증 상태 관리 Hook (localStorage 기반)
 */
export function useAuth() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = getUser()
    setUser(u)
    setLoading(false)
  }, [])

  const logout = useCallback(() => {
    clearAuth()
    setUser(null)
    router.push("/login")
  }, [router])

  return { user, loading, logout }
}
