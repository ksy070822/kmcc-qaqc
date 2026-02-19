"use client"

import { useState } from "react"
import { ReportGenerator, type ReportConfig } from "./report-generator"
import { ReportPreview } from "./report-preview"
import { useReports } from "@/hooks/use-reports"

export function AnalyticsReports() {
  const [currentReport, setCurrentReport] = useState<any>(null)
  const { generateReport, loading: isGenerating, error } = useReports()

  const handleGenerate = async (config: ReportConfig) => {
    const report = await generateReport(config as any)
    if (report) {
      setCurrentReport(report)
    }
  }

  const handleDownload = () => {
    if (!currentReport) {
      alert("다운로드할 보고서가 없습니다.")
      return
    }

    try {
      // Generate CSV as interim solution
      const csv = generateReportCSV(currentReport)

      // Create blob and download
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)

      const timestamp = new Date().toISOString().split("T")[0]
      link.setAttribute("href", url)
      link.setAttribute("download", `보고서_${timestamp}.csv`)
      link.style.visibility = "hidden"

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error("Failed to download report:", error)
      alert("보고서 다운로드에 실패했습니다.")
    }
  }

  const generateReportCSV = (report: any): string => {
    // Basic CSV generation for report data
    let csv = "QC 품질관리 보고서\n"
    csv += `생성일: ${new Date().toLocaleString("ko-KR")}\n\n`

    if (report.title) {
      csv += `제목: ${report.title}\n`
    }

    if (report.summary) {
      csv += `\n요약:\n`
      Object.entries(report.summary).forEach(([key, value]) => {
        csv += `${key}: ${value}\n`
      })
    }

    if (report.data && Array.isArray(report.data)) {
      csv += `\n상세 데이터:\n`
      const headers = Object.keys(report.data[0] || {})
      csv += headers.join(",") + "\n"
      report.data.forEach((row: any) => {
        csv += headers.map((h) => {
          const value = row[h]
          return typeof value === "string" && value.includes(",") ? `"${value}"` : value
        }).join(",") + "\n"
      })
    }

    return csv
  }

  return (
    <div className="space-y-6">
      <ReportGenerator onGenerate={handleGenerate} isGenerating={isGenerating} />
      <ReportPreview report={currentReport} onDownload={handleDownload} />
    </div>
  )
}
