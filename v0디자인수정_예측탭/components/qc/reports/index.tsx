"use client"

import { useState } from "react"
import { ReportGenerator, type ReportConfig } from "./report-generator"
import { ReportPreview } from "./report-preview"
import { groups } from "@/lib/mock-data"

export function AnalyticsReports() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentReport, setCurrentReport] = useState<any>(null)

  const handleGenerate = async (config: ReportConfig) => {
    setIsGenerating(true)

    await new Promise((resolve) => setTimeout(resolve, 1500))

    const getTypeLabel = (type: string) => {
      switch (type) {
        case "weekly":
          return config.period.includes("W") ? `2024년 ${config.period.split("W")[1]}주차` : config.period
        case "monthly":
          return `2024년 ${config.period.split("-")[1]}월`
        case "quarterly":
          return config.period.includes("Q4") ? "2024년 4분기" : "2024년 3분기"
        case "halfYear":
          return config.period.includes("H2") ? "2024년 하반기" : "2024년 상반기"
        case "yearly":
          return `${config.period}년`
        case "custom":
          return config.period
        default:
          return config.period
      }
    }

    const mockReport = {
      type: config.type,
      period: getTypeLabel(config.type),
      center: config.center,
      summary: {
        totalEvaluations: Math.floor(Math.random() * 2000) + 3000,
        totalAgents: 312,
        overallErrorRate: Number((Math.random() * 1.5 + 2).toFixed(2)),
        errorRateTrend: Number((Math.random() * 1 - 0.5).toFixed(2)),
        targetAchievement: Number((Math.random() * 10 + 90).toFixed(1)),
        improvedAgents: Math.floor(Math.random() * 30) + 20,
        needsAttention: Math.floor(Math.random() * 15) + 5,
      },
      topIssues: [
        { name: "전산 세팅오류", count: Math.floor(Math.random() * 50) + 30, rate: 2.1 },
        { name: "본인확인 누락", count: Math.floor(Math.random() * 40) + 25, rate: 1.8 },
        { name: "가이드 미준수", count: Math.floor(Math.random() * 35) + 20, rate: 1.5 },
        { name: "필수멘트 누락", count: Math.floor(Math.random() * 30) + 15, rate: 1.2 },
        { name: "불친절", count: Math.floor(Math.random() * 25) + 10, rate: 0.9 },
      ],
      centerComparison: [
        { name: "용산", errorRate: Number((Math.random() * 1 + 2).toFixed(2)), agents: 180 },
        { name: "광주", errorRate: Number((Math.random() * 1 + 2.5).toFixed(2)), agents: 132 },
      ],
      dailyTrend: Array.from({ length: config.type === "weekly" ? 7 : 14 }, (_, i) => ({
        date: config.type === "weekly" ? ["월", "화", "수", "목", "금", "토", "일"][i] : `${i + 1}일`,
        errorRate: Number((Math.random() * 1.5 + 2).toFixed(2)),
        target: 3.0,
      })),
      groupRanking: [
        ...groups["용산"].map((g) => ({
          group: g,
          center: "용산",
          errorRate: Number((Math.random() * 2 + 1.5).toFixed(2)),
          trend: Number((Math.random() * 1 - 0.5).toFixed(2)),
        })),
        ...groups["광주"].map((g) => ({
          group: g,
          center: "광주",
          errorRate: Number((Math.random() * 2 + 2).toFixed(2)),
          trend: Number((Math.random() * 1 - 0.5).toFixed(2)),
        })),
      ].sort((a, b) => a.errorRate - b.errorRate),
    }

    setCurrentReport(mockReport)
    setIsGenerating(false)
  }

  const handleDownload = () => {
    alert("PDF 다운로드 기능 (실제 구현 시 PDF 라이브러리 사용)")
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">분석 리포트</h1>
        <p className="text-sm text-slate-500">기간별, 조건별 품질 분석 리포트를 생성합니다.</p>
      </div>

      <ReportGenerator onGenerate={handleGenerate} isGenerating={isGenerating} />
      <ReportPreview report={currentReport} onDownload={handleDownload} />
    </div>
  )
}
