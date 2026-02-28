"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { FileText, Eye, Loader2, Calendar, CheckCircle, Clock, Edit } from "lucide-react"
import { useWeeklyReports } from "@/hooks/use-weekly-reports"
import type { WeeklyReportItem } from "@/lib/types"

interface WeeklyReportHistoryProps {
  center?: string
  service?: string
}

const STATUS_BADGE: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  draft: {
    label: "임시저장",
    className: "bg-gray-100 text-gray-600 border-gray-300",
    icon: <Edit className="h-3 w-3" />,
  },
  submitted: {
    label: "제출완료",
    className: "bg-blue-100 text-blue-700 border-blue-300",
    icon: <Clock className="h-3 w-3" />,
  },
  reviewed: {
    label: "검토완료",
    className: "bg-green-100 text-green-700 border-green-300",
    icon: <CheckCircle className="h-3 w-3" />,
  },
}

export function WeeklyReportHistory({ center, service }: WeeklyReportHistoryProps) {
  const [statusFilter, setStatusFilter] = useState("all")
  const [detailReport, setDetailReport] = useState<WeeklyReportItem | null>(null)

  const { data: reports, loading, error } = useWeeklyReports({
    center: center !== "all" ? center : undefined,
    service: service !== "all" ? service : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  })

  return (
    <div className="space-y-4">
      {/* 필터 */}
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 bg-white border-slate-200">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="draft">임시저장</SelectItem>
            <SelectItem value="submitted">제출완료</SelectItem>
            <SelectItem value="reviewed">검토완료</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-2 rounded-md text-sm border border-red-200">
          {error}
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin mr-2 text-slate-400" />
          <span className="text-slate-500">데이터 로딩 중...</span>
        </div>
      )}

      {/* 테이블 */}
      {!loading && (
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <FileText className="h-5 w-5 text-[#1e3a5f]" />
              주간보고 이력
              <span className="text-sm font-normal text-slate-500">
                ({reports?.length || 0}건)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-slate-200 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead>주차</TableHead>
                    <TableHead>센터</TableHead>
                    <TableHead>서비스그룹</TableHead>
                    <TableHead className="text-right">검수</TableHead>
                    <TableHead className="text-right">태도</TableHead>
                    <TableHead className="text-right">오상담</TableHead>
                    <TableHead className="text-center">부진등록</TableHead>
                    <TableHead>작성자</TableHead>
                    <TableHead className="text-center">상태</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!reports || reports.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-slate-400">
                        주간보고 이력이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reports.map((report) => {
                      const statusBadge = STATUS_BADGE[report.status] || STATUS_BADGE.draft
                      return (
                        <TableRow key={report.reportId} className="hover:bg-slate-50">
                          <TableCell className="font-medium text-slate-900">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              {report.reportWeek}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                report.center === "용산"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-yellow-50 text-yellow-700 border-yellow-200",
                              )}
                            >
                              {report.center}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600">{report.service}</TableCell>
                          <TableCell className="text-right font-mono text-slate-600">
                            {report.weekEvaluations}건
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            <span className={cn(report.weekAttitudeRate > 3 ? "text-red-600 font-bold" : "text-slate-600")}>
                              {report.weekAttitudeRate.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            <span className={cn(report.weekOpsRate > 4 ? "text-red-600 font-bold" : "text-slate-600")}>
                              {report.weekOpsRate.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {report.registeredAgentCount > 0 ? (
                              <Badge className="bg-red-100 text-red-700 border-red-200">
                                {report.registeredAgentCount}명
                              </Badge>
                            ) : (
                              <span className="text-slate-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {report.managerName || "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={cn("gap-1", statusBadge.className)}>
                              {statusBadge.icon}
                              {statusBadge.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDetailReport(report)}
                              className="border-slate-200 bg-transparent"
                            >
                              <Eye className="mr-1 h-3 w-3" />
                              보기
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 상세 보기 모달 */}
      <Dialog open={!!detailReport} onOpenChange={() => setDetailReport(null)}>
        <DialogContent className="max-w-2xl bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <FileText className="h-5 w-5 text-[#1e3a5f]" />
              주간보고 상세 - {detailReport?.reportWeek}
            </DialogTitle>
          </DialogHeader>

          {detailReport && (
            <div className="space-y-4">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-center">
                  <div className="text-xs text-slate-500">센터</div>
                  <div className="font-medium text-slate-900">{detailReport.center}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-center">
                  <div className="text-xs text-slate-500">서비스그룹</div>
                  <div className="font-medium text-slate-900">{detailReport.service}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-center">
                  <div className="text-xs text-slate-500">검수 건수</div>
                  <div className="font-medium text-slate-900">{detailReport.weekEvaluations}건</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-center">
                  <div className="text-xs text-slate-500">작성자</div>
                  <div className="font-medium text-slate-900">{detailReport.managerName || "-"}</div>
                </div>
              </div>

              {/* 오류율 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <div className="text-xs text-blue-600 mb-1">태도 오류율</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-blue-700">
                      {detailReport.weekAttitudeRate.toFixed(1)}%
                    </span>
                    <span className="text-xs text-blue-500">
                      (전주 {detailReport.prevWeekAttitudeRate.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                  <div className="text-xs text-red-600 mb-1">오상담 오류율</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-red-700">
                      {detailReport.weekOpsRate.toFixed(1)}%
                    </span>
                    <span className="text-xs text-red-500">
                      (전주 {detailReport.prevWeekOpsRate.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* 관리자 입력 필드 */}
              <div className="space-y-3">
                <div className="border border-slate-200 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1 font-medium">전주 활동내용</div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">
                    {detailReport.prevWeekActivities || "(미입력)"}
                  </div>
                </div>
                <div className="border border-slate-200 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1 font-medium">금주 부진항목</div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">
                    {detailReport.currentWeekIssues || "(미입력)"}
                  </div>
                </div>
                <div className="border border-slate-200 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1 font-medium">원인 분석</div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">
                    {detailReport.causeAnalysis || "(미입력)"}
                  </div>
                </div>
                <div className="border border-slate-200 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1 font-medium">차주 활동계획</div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">
                    {detailReport.nextWeekPlan || "(미입력)"}
                  </div>
                </div>
              </div>

              {/* 본사 검토 코멘트 */}
              {detailReport.reviewComment && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="text-xs text-amber-600 mb-1 font-medium">
                    본사 검토 ({detailReport.reviewedBy})
                  </div>
                  <div className="text-sm text-amber-700 whitespace-pre-wrap">
                    {detailReport.reviewComment}
                  </div>
                </div>
              )}

              {/* 집중관리상담사 등록 수 */}
              {detailReport.registeredAgentCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  이번 주 집중관리상담사 <span className="font-bold">{detailReport.registeredAgentCount}명</span> 등록
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
