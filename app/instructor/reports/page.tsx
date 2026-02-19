"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import { FileText, Loader2, Calendar, User } from "lucide-react"

interface WeeklyReport {
  reportId: string
  weekLabel: string
  weekRange: string
  center: string
  service: string
  status: string
  createdBy: string
  createdAt: string
  weekEvaluations: number
  weekAttitudeRate: number
  weekOpsRate: number
  improvement: string
  actionPlan: string
}

export default function InstructorReportsPage() {
  const { user } = useAuth()
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchReports() {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        if (user?.center) params.append("center", user.center)

        const res = await fetch(`/api/weekly-reports?${params}`)
        const data = await res.json()

        if (data.success && data.data?.reports) {
          setReports(data.data.reports)
        }
      } catch {
        setReports([])
      } finally {
        setLoading(false)
      }
    }
    fetchReports()
  }, [user?.center])

  const statusLabel = (s: string) => {
    switch (s) {
      case "submitted": return { text: "제출됨", color: "bg-blue-50 text-blue-700 border-blue-200" }
      case "reviewed": return { text: "검토완료", color: "bg-green-50 text-green-700 border-green-200" }
      case "draft": return { text: "임시저장", color: "bg-slate-50 text-slate-600 border-slate-200" }
      default: return { text: s, color: "bg-slate-50 text-slate-600 border-slate-200" }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#7c3aed]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">리포트</h1>
        <p className="text-sm text-slate-500 mt-1">
          {user?.center ? `${user.center} 센터` : "전체"} 주간 보고서 현황
        </p>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-slate-400">
              <FileText className="h-12 w-12 mb-3" />
              <p className="text-base font-medium mb-1">등록된 보고서가 없습니다</p>
              <p className="text-sm">팀장이 주간 보고서를 작성하면 여기에 표시됩니다</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const st = statusLabel(report.status)
            return (
              <Card key={report.reportId} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-[#7c3aed]" />
                      {report.weekLabel} ({report.weekRange})
                    </CardTitle>
                    <Badge variant="outline" className={st.color}>{st.text}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-slate-500">서비스</p>
                      <p className="text-sm font-medium text-slate-900">{report.service}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">검수건수</p>
                      <p className="text-sm font-medium text-slate-900">{report.weekEvaluations}건</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">태도 오류율</p>
                      <p className={`text-sm font-medium ${report.weekAttitudeRate > 3.3 ? "text-red-600" : "text-slate-900"}`}>
                        {report.weekAttitudeRate.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">오상담 오류율</p>
                      <p className={`text-sm font-medium ${report.weekOpsRate > 3.9 ? "text-red-600" : "text-slate-900"}`}>
                        {report.weekOpsRate.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {(report.improvement || report.actionPlan) && (
                    <div className="space-y-2 pt-3 border-t border-slate-100">
                      {report.improvement && (
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-0.5">개선사항</p>
                          <p className="text-sm text-slate-700">{report.improvement}</p>
                        </div>
                      )}
                      {report.actionPlan && (
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-0.5">액션플랜</p>
                          <p className="text-sm text-slate-700">{report.actionPlan}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1 mt-3 text-xs text-slate-400">
                    <User className="h-3 w-3" />
                    <span>{report.createdBy}</span>
                    <span className="mx-1">·</span>
                    <span>{report.createdAt?.split("T")[0]}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
