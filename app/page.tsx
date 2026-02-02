"use client"

import { useState, useCallback, useEffect } from "react"
import { Sidebar } from "@/components/qc/sidebar"
import { Header } from "@/components/qc/header"
import { Dashboard } from "@/components/qc/dashboard"
import { AgentAnalysis } from "@/components/qc/agents"
import { FocusManagement } from "@/components/qc/focus"
import { AnalyticsReports } from "@/components/qc/reports"
import { GoalManagement } from "@/components/qc/goals"
import { SettingsPage } from "@/components/qc/settings"
import { Predictions } from "@/components/qc/predictions"
import { AIAssistant } from "@/components/qc/ai-assistant"
import { cn } from "@/lib/utils"

export default function QCManagementApp() {
  const [currentTab, setCurrentTab] = useState("dashboard")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedDate, setSelectedDate] = useState("")
  const [searchDate, setSearchDate] = useState("")
  const [lastUpdated, setLastUpdated] = useState("--:--:--")
  
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
        return <Dashboard onNavigateToFocus={handleNavigateToFocus} selectedDate={searchDate} />
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

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        alertCount={12}
      />

      <div className={cn("transition-all duration-300", sidebarCollapsed ? "ml-16" : "ml-60")}>
        <Header
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onRefresh={handleRefresh}
          onSearch={handleSearch}
          lastUpdated={lastUpdated}
        />

        <main className="p-6">{renderContent()}</main>
      </div>
    </div>
  )
}
