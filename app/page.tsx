"use client"

import { useState, useCallback } from "react"
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
  // 기본값을 전일(어제)로 설정 - 오늘은 평가 진행 중이므로 어제 결과를 보여줌
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split("T")[0]
  const [selectedDate, setSelectedDate] = useState(yesterdayStr)
  const [searchDate, setSearchDate] = useState(yesterdayStr)
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString("ko-KR"))

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
