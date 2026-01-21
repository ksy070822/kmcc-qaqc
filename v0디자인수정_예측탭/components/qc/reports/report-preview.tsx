"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  Download,
  FileText,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  CheckCircle,
  BarChart3,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  Cell,
  ReferenceLine,
} from "recharts"

interface ReportData {
  type: string
  period: string
  center: string
  summary: {
    totalEvaluations: number
    totalAgents: number
    overallErrorRate: number
    errorRateTrend: number
    targetAchievement: number
    improvedAgents: number
    needsAttention: number
  }
  topIssues: Array<{ name: string; count: number; rate: number }>
  centerComparison: Array<{ name: string; errorRate: number; agents: number }>
  dailyTrend: Array<{ date: string; errorRate: number; target: number }>
  groupRanking: Array<{ group: string; center: string; errorRate: number; trend: number }>
}

interface ReportPreviewProps {
  report: ReportData | null
  onDownload: () => void
}

const CHART_COLORS = ["#3b82f6", "#f59e0b", "#22c55e", "#ef4444", "#8b5cf6", "#ec4899"]

export function ReportPreview({ report, onDownload }: ReportPreviewProps) {
  if (!report) {
    return (
      <Card className="flex h-[400px] items-center justify-center">
        <div className="text-center text-muted-foreground">
          <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>리포트를 생성하면 여기에 미리보기가 표시됩니다.</p>
        </div>
      </Card>
    )
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "weekly":
        return "주간"
      case "monthly":
        return "월간"
      case "quarterly":
        return "분기"
      case "halfYear":
        return "반기"
      case "yearly":
        return "연간"
      case "custom":
        return "특정기간"
      default:
        return type
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between bg-primary/5 border-b">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {getTypeLabel(report.type)} 품질 리포트
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {report.period} | {report.center === "all" ? "전체 센터" : `${report.center}센터`}
          </p>
        </div>
        <Button onClick={onDownload}>
          <Download className="mr-2 h-4 w-4" />
          PDF 다운로드
        </Button>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />총 평가건수
            </div>
            <p className="mt-1 text-2xl font-bold">{report.summary.totalEvaluations.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <div className="text-sm text-muted-foreground">평균 오류율</div>
            <p className="mt-1 flex items-center gap-2 text-2xl font-bold">
              {report.summary.overallErrorRate.toFixed(2)}%
              <span
                className={cn(
                  "flex items-center text-sm",
                  report.summary.errorRateTrend < 0 ? "text-green-600" : "text-red-600",
                )}
              >
                {report.summary.errorRateTrend < 0 ? (
                  <TrendingDown className="h-4 w-4" />
                ) : (
                  <TrendingUp className="h-4 w-4" />
                )}
                {Math.abs(report.summary.errorRateTrend).toFixed(2)}%
              </span>
            </p>
          </div>
          <div className="rounded-lg border border-green-300 bg-green-50 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-600" />
              개선 상담사
            </div>
            <p className="mt-1 text-2xl font-bold text-green-600">{report.summary.improvedAgents}명</p>
          </div>
          <div className="rounded-lg border border-red-300 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              주의 필요
            </div>
            <p className="mt-1 text-2xl font-bold text-red-600">{report.summary.needsAttention}명</p>
          </div>
        </div>

        <Separator />

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h4 className="font-semibold">오류율 추이</h4>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={report.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} domain={[0, 6]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                  />
                  <Legend />
                  <ReferenceLine
                    y={3}
                    stroke="#ef4444"
                    strokeDasharray="5 5"
                    label={{ value: "목표", fill: "#ef4444", fontSize: 11 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="errorRate"
                    name="오류율"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">주요 오류 항목</h4>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.topIssues} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: "#374151", fontSize: 11 }} width={100} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {report.topIssues.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="font-semibold">그룹별 순위 (오류율 낮은 순)</h4>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {report.groupRanking.slice(0, 6).map((group, i) => (
              <div key={group.group} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                      i === 0 && "bg-yellow-400 text-yellow-900",
                      i === 1 && "bg-slate-300 text-slate-700",
                      i === 2 && "bg-amber-600 text-white",
                      i > 2 && "bg-muted text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <span className="font-medium text-sm">{group.group}</span>
                    <Badge variant="outline" className="ml-2 text-xs">
                      {group.center}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold">{group.errorRate.toFixed(2)}%</span>
                  <span className={cn("ml-2 text-xs", group.trend < 0 ? "text-green-600" : "text-red-600")}>
                    {group.trend > 0 ? "+" : ""}
                    {group.trend.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
