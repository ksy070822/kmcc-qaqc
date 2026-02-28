"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  UserX,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { useUnderperforming } from "@/hooks/use-underperforming"
import type { UnderperformingAgent } from "@/lib/types"

interface UnderperformingTableProps {
  center?: string
  service?: string
  onViewDetail: (agent: UnderperformingAgent) => void
}

const STATUS_CONFIG: Record<
  UnderperformingAgent["status"],
  { label: string; color: string; icon: React.ReactNode }
> = {
  registered: {
    label: "등록",
    color: "bg-gray-100 text-gray-700 border-gray-300",
    icon: <Clock className="h-3 w-3" />,
  },
  tracking: {
    label: "추적 중",
    color: "bg-blue-100 text-blue-700 border-blue-300",
    icon: <Eye className="h-3 w-3" />,
  },
  improved: {
    label: "개선",
    color: "bg-green-100 text-green-700 border-green-300",
    icon: <TrendingDown className="h-3 w-3" />,
  },
  resolved: {
    label: "해소",
    color: "bg-emerald-100 text-emerald-700 border-emerald-300",
    icon: <CheckCircle className="h-3 w-3" />,
  },
  escalated: {
    label: "에스컬레이션",
    color: "bg-red-100 text-red-700 border-red-300",
    icon: <AlertCircle className="h-3 w-3" />,
  },
}

export function UnderperformingTable({ center, service, onViewDetail }: UnderperformingTableProps) {
  const [statusFilter, setStatusFilter] = useState("all")

  const { data: agents, loading, error } = useUnderperforming({
    center: center !== "all" ? center : undefined,
    service,
    status: statusFilter !== "all" ? statusFilter : undefined,
  })

  // 통계 요약
  const stats = useMemo(() => {
    if (!agents || agents.length === 0) return null
    const byStatus = {
      tracking: agents.filter((a) => a.status === "tracking").length,
      improved: agents.filter((a) => a.status === "improved").length,
      resolved: agents.filter((a) => a.status === "resolved").length,
      escalated: agents.filter((a) => a.status === "escalated").length,
      registered: agents.filter((a) => a.status === "registered").length,
    }
    return { total: agents.length, ...byStatus }
  }, [agents])

  const getChangeBadge = (baseline: number, current: number) => {
    const diff = current - baseline
    if (Math.abs(diff) < 0.1) {
      return (
        <span className="flex items-center gap-1 text-slate-500">
          <Minus className="h-3 w-3" />
          {diff.toFixed(1)}%p
        </span>
      )
    }
    if (diff < 0) {
      return (
        <span className="flex items-center gap-1 text-green-600 font-medium">
          <TrendingDown className="h-3 w-3" />
          {diff.toFixed(1)}%p
        </span>
      )
    }
    return (
      <span className="flex items-center gap-1 text-red-600 font-medium">
        <TrendingUp className="h-3 w-3" />
        +{diff.toFixed(1)}%p
      </span>
    )
  }

  return (
    <div className="space-y-4">
      {/* 요약 통계 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
            <div className="text-xs text-slate-500">전체</div>
            <div className="text-xl font-bold text-slate-900">{stats.total}명</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
            <div className="text-xs text-blue-600">추적 중</div>
            <div className="text-xl font-bold text-blue-700">{stats.tracking + stats.registered}명</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
            <div className="text-xs text-green-600">개선</div>
            <div className="text-xl font-bold text-green-700">{stats.improved}명</div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-200">
            <div className="text-xs text-emerald-600">해소</div>
            <div className="text-xl font-bold text-emerald-700">{stats.resolved}명</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
            <div className="text-xs text-red-600">에스컬레이션</div>
            <div className="text-xl font-bold text-red-700">{stats.escalated}명</div>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 bg-white border-slate-200">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="registered">등록</SelectItem>
            <SelectItem value="tracking">추적 중</SelectItem>
            <SelectItem value="improved">개선</SelectItem>
            <SelectItem value="resolved">해소</SelectItem>
            <SelectItem value="escalated">에스컬레이션</SelectItem>
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
              <UserX className="h-5 w-5 text-red-500" />
              집중관리상담사 목록
              <span className="text-sm font-normal text-slate-500">
                ({agents?.length || 0}명)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-slate-200 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead>상담사</TableHead>
                    <TableHead>센터</TableHead>
                    <TableHead>서비스/채널</TableHead>
                    <TableHead>등록주</TableHead>
                    <TableHead className="text-center">추적기간</TableHead>
                    <TableHead className="text-right">기준선 (태도/업무)</TableHead>
                    <TableHead className="text-right">현재 (태도/업무)</TableHead>
                    <TableHead className="text-right">변화</TableHead>
                    <TableHead className="text-center">상태</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!agents || agents.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-slate-400">
                        등록된 집중관리상담사가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    agents.map((agent) => {
                      const statusConf = STATUS_CONFIG[agent.status]
                      const attChange = agent.currentAttitudeRate - agent.baselineAttitudeRate
                      const opsChange = agent.currentOpsRate - agent.baselineOpsRate
                      const overallChange = attChange + opsChange

                      return (
                        <TableRow key={agent.trackingId} className="hover:bg-slate-50">
                          <TableCell className="font-medium text-slate-900">
                            {agent.agentId} / {agent.agentName}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                agent.center === "용산"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-yellow-50 text-yellow-700 border-yellow-200",
                              )}
                            >
                              {agent.center}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600 text-sm">
                            {agent.service}/{agent.channel}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {agent.registeredWeek}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                agent.weeksTracked > 4
                                  ? "bg-red-50 border-red-300 text-red-600"
                                  : "bg-slate-50 border-slate-200",
                              )}
                            >
                              {agent.weeksTracked}주
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            <span className="text-slate-500">
                              {agent.baselineAttitudeRate.toFixed(1)}%
                            </span>
                            {" / "}
                            <span className="text-slate-500">
                              {agent.baselineOpsRate.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            <span className={cn(agent.currentAttitudeRate > agent.baselineAttitudeRate ? "text-red-600" : "text-green-600")}>
                              {agent.currentAttitudeRate.toFixed(1)}%
                            </span>
                            {" / "}
                            <span className={cn(agent.currentOpsRate > agent.baselineOpsRate ? "text-red-600" : "text-green-600")}>
                              {agent.currentOpsRate.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {getChangeBadge(
                              agent.baselineAttitudeRate + agent.baselineOpsRate,
                              agent.currentAttitudeRate + agent.currentOpsRate,
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={cn("gap-1", statusConf.color)}>
                              {statusConf.icon}
                              {statusConf.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onViewDetail(agent)}
                              className="border-slate-200 bg-transparent"
                            >
                              <Eye className="mr-1 h-3 w-3" />
                              상세
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
    </div>
  )
}
