"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { ROLE_CONFIG } from "@/lib/auth"
import { Sidebar } from "@/components/qc/sidebar"
import { Header } from "@/components/qc/header"
import { Dashboard } from "@/components/qc/dashboard"
import { QualityDashboard } from "@/components/qc/quality-dashboard"
import { AgentAnalysis } from "@/components/qc/agents"
import { FocusManagement } from "@/components/qc/focus"
import { AnalyticsReports } from "@/components/qc/reports"
import { GoalManagement } from "@/components/qc/goals"
import { SettingsPage } from "@/components/qc/settings"
import { Predictions } from "@/components/qc/predictions"
import { AIAssistant } from "@/components/qc/ai-assistant"
import { cn } from "@/lib/utils"

export default function QCManagementApp() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [currentTab, setCurrentTab] = useState("dashboard")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedDate, setSelectedDate] = useState("")
  const [searchDate, setSearchDate] = useState("")
  const [lastUpdated, setLastUpdated] = useState("--:--:--")
  const [alertCount, setAlertCount] = useState(0)

  // 역할 기반 라우트 보호
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace("/login")
      return
    }
    if (user.role !== "hq_admin") {
      router.replace(ROLE_CONFIG[user.role].defaultRoute)
    }
  }, [user, authLoading, router])

  // 클라이언트에서만 날짜 및 시간 설정 (hydration 오류 방지)
  useEffect(() => {
    // 전일 날짜 계산 (KST 기준)
    const now = new Date()
    const kstOffset = 9 * 60 * 60 * 1000 // 9시간
    const kstTime = new Date(now.getTime() + kstOffset)
    const yesterday = new Date(kstTime)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)

    const year = yesterday.getUTCFullYear()
    const month = String(yesterday.getUTCMonth() + 1).padStart(2, '0')
    const day = String(yesterday.getUTCDate()).padStart(2, '0')
    const yesterdayStr = `${year}-${month}-${day}`

    setSelectedDate(yesterdayStr)
    setSearchDate(yesterdayStr)
    setLastUpdated(new Date().toLocaleTimeString("ko-KR"))

    // Fetch alert count from watchlist data
    const fetchAlertCount = async () => {
      try {
        const response = await fetch('/api/watchlist?action=count')
        const result = await response.json()
        if (result.success && result.data) {
          setAlertCount(result.data.count)
        }
      } catch (err) {
        console.error('Failed to fetch alert count:', err)
        // Keep default count of 0
      }
    }

    fetchAlertCount()
  }, [])

  const handleRefresh = useCallback(() => {
    setLastUpdated(new Date().toLocaleTimeString("ko-KR"))
    // Trigger search with current date
    setSearchDate(selectedDate)
  }, [selectedDate])

  const handleSearch = useCallback(() => {
    setSearchDate(selectedDate)
    setLastUpdated(new Date().toLocaleTimeString("ko-KR"))
  }, [selectedDate])

  const handleNavigateToFocus = useCallback(() => {
    setCurrentTab("focus")
  }, [])

  const renderContent = () => {
    switch (currentTab) {
      case "dashboard":
        return <QualityDashboard onNavigateToFocus={handleNavigateToFocus} />
      case "predictions":
        return <Predictions onNavigateToFocus={handleNavigateToFocus} />
      case "agents":
        return <AgentAnalysis />
      case "ai-assistant":
        return <AIAssistant />
      case "focus":
        return <FocusManagement />
      case "reports":
        return <AnalyticsReports />
      case "goals":
        return <GoalManagement />
      case "settings":
        return <SettingsPage />
      default:
        return null
    }
  }

  // 인증 로딩 중이거나 비인가 사용자면 빈 화면
  if (authLoading || !user || user.role !== "hq_admin") {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        alertCount={alertCount}
      />

      <div className={cn("transition-all duration-300", sidebarCollapsed ? "ml-16" : "ml-60")}>
        <Header
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onRefresh={handleRefresh}
          onSearch={handleSearch}
          lastUpdated={lastUpdated}
          alertCount={alertCount}
        />

        <main className="p-6">{renderContent()}</main>
      </div>
    </div>
  )
}
