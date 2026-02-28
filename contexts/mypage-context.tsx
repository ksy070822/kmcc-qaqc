'use client'

import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useMypageProfile } from '@/hooks/use-mypage-profile'
import type { UserInfo } from '@/lib/auth'
import type { MypageProfile } from '@/lib/types'

interface MypageContextType {
  /** Authenticated user information */
  user: UserInfo | null
  /** Derived agentId from user (userId fallback) */
  agentId: string | null
  /** Center name from user profile */
  center: string | null
  /** Service name from user profile */
  service: string | null
  /** Base mypage profile metrics (fetched once, shared across views) */
  baseMetrics: MypageProfile | null
  /** Whether profile data is still loading */
  profileLoading: boolean
  /** Profile fetch error */
  profileError: string | null
  /** Re-fetch profile data */
  refetchProfile: () => void
  /** Productivity data (center-level, fetched once) */
  productivity: { voice: number; chat: number } | null
  /** Whether productivity data is loading */
  productivityLoading: boolean
}

const MypageContext = createContext<MypageContextType>({
  user: null,
  agentId: null,
  center: null,
  service: null,
  baseMetrics: null,
  profileLoading: true,
  profileError: null,
  refetchProfile: () => {},
  productivity: null,
  productivityLoading: true,
})

export function MypageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const agentId = user?.userId ?? null
  const center = user?.center ?? null
  const service = user?.service ?? null

  // Profile: single fetch shared across all mypage views
  const { data: baseMetrics, loading: profileLoading, error: profileError, refetch: refetchProfile } = useMypageProfile(agentId)

  // Productivity: center-level metrics fetched once
  const [productivity, setProductivity] = useState<{ voice: number; chat: number } | null>(null)
  const [productivityLoading, setProductivityLoading] = useState(true)

  useEffect(() => {
    async function fetchProductivity() {
      if (!agentId) {
        setProductivityLoading(false)
        return
      }
      try {
        setProductivityLoading(true)
        const refDate = new Date().toISOString().slice(0, 10)
        const params = new URLSearchParams({
          type: 'multi-domain-metrics',
          refDate,
        })
        if (center) params.set('center', center)
        const res = await fetch(`/api/role-metrics?${params}`)
        const d = await res.json()
        if (d.success) {
          setProductivity({
            voice: d.metrics.voiceResponseRate ?? 0,
            chat: d.metrics.chatResponseRate ?? 0,
          })
        }
      } catch {
        /* silent */
      } finally {
        setProductivityLoading(false)
      }
    }
    fetchProductivity()
  }, [agentId, center])

  const value = useMemo<MypageContextType>(
    () => ({
      user,
      agentId,
      center,
      service,
      baseMetrics,
      profileLoading,
      profileError,
      refetchProfile,
      productivity,
      productivityLoading,
    }),
    [user, agentId, center, service, baseMetrics, profileLoading, profileError, refetchProfile, productivity, productivityLoading],
  )

  return <MypageContext.Provider value={value}>{children}</MypageContext.Provider>
}

export const useMypageContext = () => useContext(MypageContext)
