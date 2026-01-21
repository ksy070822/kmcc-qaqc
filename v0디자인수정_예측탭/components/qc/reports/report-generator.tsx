"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar, FileText, Loader2 } from "lucide-react"
import { tenureCategories, serviceGroups, channelTypes } from "@/lib/mock-data"

interface ReportGeneratorProps {
  onGenerate: (config: ReportConfig) => void
  isGenerating: boolean
}

export interface ReportConfig {
  type: string
  period: string
  startDate?: string
  endDate?: string
  center: string
  channel: string
  serviceGroup: string
  tenure: string
}

export function ReportGenerator({ onGenerate, isGenerating }: ReportGeneratorProps) {
  const [reportType, setReportType] = useState("weekly")
  const [period, setPeriod] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [center, setCenter] = useState("all")
  const [channel, setChannel] = useState("all")
  const [serviceGroup, setServiceGroup] = useState("all")
  const [tenure, setTenure] = useState("all")

  const weekOptions = Array.from({ length: 4 }, (_, i) => {
    const weekNum = 50 - i
    return { value: `2024-W${weekNum}`, label: `2024년 ${weekNum}주차` }
  })

  const monthOptions = Array.from({ length: 3 }, (_, i) => {
    const month = 12 - i
    return { value: `2024-${String(month).padStart(2, "0")}`, label: `2024년 ${month}월` }
  })

  const quarterOptions = [
    { value: "2024-Q4", label: "2024년 4분기" },
    { value: "2024-Q3", label: "2024년 3분기" },
  ]

  const halfYearOptions = [
    { value: "2024-H2", label: "2024년 하반기" },
    { value: "2024-H1", label: "2024년 상반기" },
  ]

  const yearOptions = [
    { value: "2024", label: "2024년" },
    { value: "2023", label: "2023년" },
  ]

  const getPeriodOptions = () => {
    switch (reportType) {
      case "weekly":
        return weekOptions
      case "monthly":
        return monthOptions
      case "quarterly":
        return quarterOptions
      case "halfYear":
        return halfYearOptions
      case "yearly":
        return yearOptions
      default:
        return []
    }
  }

  const availableServiceGroups =
    center === "all"
      ? [...new Set([...serviceGroups["용산"], ...serviceGroups["광주"]])]
      : center === "용산"
        ? serviceGroups["용산"]
        : serviceGroups["광주"]

  const handleGenerate = () => {
    onGenerate({
      type: reportType,
      period: reportType === "custom" ? `${startDate} ~ ${endDate}` : period,
      startDate: reportType === "custom" ? startDate : undefined,
      endDate: reportType === "custom" ? endDate : undefined,
      center,
      channel,
      serviceGroup,
      tenure,
    })
  }

  const isValid =
    reportType === "custom" ? startDate && endDate : period || reportType === "weekly" || reportType === "monthly"

  const handleCenterChange = (value: string) => {
    setCenter(value)
    // 센터 변경 시 서비스그룹 초기화
    setServiceGroup("all")
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5 text-[#1e3a5f]" />
          리포트 생성
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>리포트 유형</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="bg-secondary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">주간</SelectItem>
                <SelectItem value="monthly">월간</SelectItem>
                <SelectItem value="quarterly">분기</SelectItem>
                <SelectItem value="halfYear">반기</SelectItem>
                <SelectItem value="yearly">연간</SelectItem>
                <SelectItem value="custom">특정기간</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {reportType === "custom" ? (
            <>
              <div className="space-y-2">
                <Label>시작일</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-secondary"
                />
              </div>
              <div className="space-y-2">
                <Label>종료일</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-secondary"
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label>기간</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="bg-secondary">
                  <Calendar className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {getPeriodOptions().map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-slate-700">센터</Label>
            <Select value={center} onValueChange={handleCenterChange}>
              <SelectTrigger className="bg-white border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="용산">용산</SelectItem>
                <SelectItem value="광주">광주</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700">서비스그룹</Label>
            <Select value={serviceGroup} onValueChange={setServiceGroup}>
              <SelectTrigger className="bg-white border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {availableServiceGroups.map((sg) => (
                  <SelectItem key={sg} value={sg}>
                    {sg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700">채널</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="bg-white border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {channelTypes.map((ch) => (
                  <SelectItem key={ch} value={ch}>
                    {ch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700">근속기간</Label>
            <Select value={tenure} onValueChange={setTenure}>
              <SelectTrigger className="bg-white border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {tenureCategories.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button onClick={handleGenerate} disabled={!isValid || isGenerating} className="w-full">
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  리포트 생성
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
