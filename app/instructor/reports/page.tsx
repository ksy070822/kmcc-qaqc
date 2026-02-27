"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import {
  FileText,
  Loader2,
  Calendar,
  User,
  ShieldCheck,
  ClipboardCheck,
  Star,
  BookOpen,
  Activity,
  Award,
  UserCheck,
} from "lucide-react"

interface WeeklyReport {
  reportId: string
  weekLabel: string
  weekRange: string
  center: string
  service: string
  status: string
  createdBy: string
  createdAt: string
  // QC (기존)
  weekEvaluations: number
  weekAttitudeRate: number
  weekOpsRate: number
  improvement: string
  actionPlan: string
  // 품질: QA + CSAT + Quiz (7도메인 확장 — optional)
  qaAvgScore?: number | null
  csatAvgScore?: number | null
  quizAvgScore?: number | null
  // 운영: SLA + 근태 (7도메인 확장 — optional)
  slaGrade?: string | null
  slaScore?: number | null
  attendanceRate?: number | null
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
          {user?.center ? `${user.center} 센터` : "전체"} 주간 보고서 현황 (QC + 품질 + 운영)
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
                <CardContent className="space-y-4">
                  {/* ── QC 모니터링 (기존) ── */}
                  <div>
                    <SectionLabel icon={ShieldCheck} text="QC 모니터링" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <ReportMetric label="서비스" value={report.service} />
                      <ReportMetric label="검수건수" value={`${report.weekEvaluations}건`} />
                      <ReportMetric
                        label="태도 오류율"
                        value={`${report.weekAttitudeRate.toFixed(1)}%`}
                        warn={report.weekAttitudeRate > 3.3}
                      />
                      <ReportMetric
                        label="오상담 오류율"
                        value={`${report.weekOpsRate.toFixed(1)}%`}
                        warn={report.weekOpsRate > 3.9}
                      />
                    </div>
                  </div>

                  {/* ── 품질 지표: QA + CSAT + Quiz ── */}
                  <div>
                    <SectionLabel icon={ClipboardCheck} text="품질 지표" />
                    <div className="grid grid-cols-3 gap-4">
                      <ReportMetricWithIcon
                        icon={ClipboardCheck}
                        iconBg="bg-blue-50"
                        iconColor="text-blue-600"
                        label="QA 점수"
                        value={report.qaAvgScore != null ? `${report.qaAvgScore.toFixed(1)}점` : "-"}
                        warn={report.qaAvgScore != null && report.qaAvgScore < 85}
                      />
                      <ReportMetricWithIcon
                        icon={Star}
                        iconBg="bg-amber-50"
                        iconColor="text-amber-600"
                        label="CSAT"
                        value={report.csatAvgScore != null ? `${report.csatAvgScore.toFixed(2)}점` : "-"}
                        warn={report.csatAvgScore != null && report.csatAvgScore < 3.5}
                      />
                      <ReportMetricWithIcon
                        icon={BookOpen}
                        iconBg="bg-green-50"
                        iconColor="text-green-600"
                        label="직무테스트"
                        value={report.quizAvgScore != null ? `${report.quizAvgScore.toFixed(1)}점` : "-"}
                        warn={report.quizAvgScore != null && report.quizAvgScore < 70}
                      />
                    </div>
                  </div>

                  {/* ═══ 운영 지표: SLA + 근태 (본사 전용 — 추후 오픈 검토) ═══
                  <div>
                    <SectionLabel icon={Activity} text="운영 지표" />
                    <div className="grid grid-cols-3 gap-4">
                      <ReportMetricWithIcon
                        icon={Award}
                        iconBg="bg-rose-50"
                        iconColor="text-rose-600"
                        label="SLA 등급"
                        value={report.slaGrade ?? "-"}
                      />
                      <ReportMetricWithIcon
                        icon={Award}
                        iconBg="bg-slate-100"
                        iconColor="text-slate-500"
                        label="SLA 점수"
                        value={report.slaScore != null ? `${report.slaScore.toFixed(1)}점` : "-"}
                      />
                      <ReportMetricWithIcon
                        icon={UserCheck}
                        iconBg="bg-teal-50"
                        iconColor="text-teal-600"
                        label="출근율"
                        value={report.attendanceRate != null ? `${report.attendanceRate.toFixed(1)}%` : "-"}
                        warn={report.attendanceRate != null && report.attendanceRate < 90}
                      />
                    </div>
                  </div>
                  */}

                  {/* ── 개선사항 / 액션플랜 ── */}
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

                  <div className="flex items-center gap-1 pt-2 text-xs text-slate-400 border-t border-slate-50">
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

// ── 공통 컴포넌트 ──

/** 섹션 구분 라벨 */
function SectionLabel({ icon: Icon, text }: {
  icon: React.ComponentType<{ className?: string }>; text: string
}) {
  return (
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {text}
    </p>
  )
}

/** 단순 메트릭 (텍스트만) */
function ReportMetric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm font-medium ${warn ? "text-red-600" : "text-slate-900"}`}>{value}</p>
    </div>
  )
}

/** 아이콘 포함 메트릭 (품질/운영 지표) */
function ReportMetricWithIcon({ icon: Icon, iconBg, iconColor, label, value, warn }: {
  icon: React.ComponentType<{ className?: string }>
  iconBg: string; iconColor: string; label: string; value: string; warn?: boolean
}) {
  const isPlaceholder = value === "-"
  return (
    <div className="flex items-start gap-2">
      <div className={`flex h-7 w-7 items-center justify-center rounded-md shrink-0 mt-0.5 ${iconBg}`}>
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className={`text-sm font-medium ${isPlaceholder ? "text-slate-300" : warn ? "text-red-600" : "text-slate-900"}`}>
          {value}
        </p>
      </div>
    </div>
  )
}
