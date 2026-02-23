"use client"

import { Badge } from "@/components/ui/badge"
import { MypageSummaryCard } from "@/components/mypage/mypage-summary-card"
import { MypageTrendChart } from "@/components/mypage/mypage-trend-chart"
import { useMypageProfile } from "@/hooks/use-mypage-profile"
import type { UserInfo } from "@/lib/auth"
import { ShieldCheck, Star, ClipboardCheck, BookOpen, Loader2 } from "lucide-react"

function getPerformanceLevel(qcRate: number): { label: string; color: string } {
  if (qcRate <= 2.0) return { label: "우수", color: "bg-emerald-50 text-emerald-700 border-emerald-200" }
  if (qcRate <= 3.0) return { label: "양호", color: "bg-blue-50 text-blue-700 border-blue-200" }
  if (qcRate <= 4.0) return { label: "보통", color: "bg-amber-50 text-amber-700 border-amber-200" }
  return { label: "주의", color: "bg-red-50 text-red-700 border-red-200" }
}

interface MypageMainViewProps {
  agentId: string | null
  user: UserInfo | null
  onNavigate: (view: string) => void
}

export function MypageMainView({ agentId, user, onNavigate }: MypageMainViewProps) {
  const { data, loading } = useMypageProfile(agentId)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">데이터를 불러오는 중...</span>
      </div>
    )
  }

  const qcRate = data?.qcRate ?? 0
  const level = getPerformanceLevel(qcRate)

  const qcPrevDiff = data ? Math.round((data.qcRate - data.qcPrevRate) * 10) / 10 : 0
  const qcGroupDiff = data ? Math.round((data.qcRate - data.qcGroupAvg) * 10) / 10 : 0
  const csatPrevDiff = data ? Math.round((data.csatScore - data.csatPrevScore) * 100) / 100 : 0
  const csatGroupDiff = data ? Math.round((data.csatScore - data.csatGroupAvg) * 100) / 100 : 0
  const qaPrevDiff = data ? Math.round((data.qaScore - data.qaPrevScore) * 10) / 10 : 0
  const qaGroupDiff = data ? Math.round((data.qaScore - data.qaGroupAvg) * 10) / 10 : 0
  const quizPrevDiff = data ? Math.round((data.quizScore - data.quizPrevScore) * 10) / 10 : 0
  const quizGroupDiff = data ? Math.round((data.quizScore - data.quizGroupAvg) * 10) / 10 : 0

  return (
    <div className="space-y-6">
      {/* Greeting header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {user?.userId ?? "상담사"}님, 반갑습니다!
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {user?.center && <span>{user.center} · </span>}통합 품질 성과 현황을 확인하세요
          </p>
        </div>
        <Badge variant="outline" className={level.color}>
          {level.label}
        </Badge>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MypageSummaryCard
          title="QC 모니터링"
          icon={ShieldCheck}
          headerColor="bg-slate-900"
          mainValue={qcRate.toFixed(1)}
          mainSuffix="%"
          comparisons={[
            { label: "전월 대비", value: qcPrevDiff, higherIsBetter: false },
            { label: "그룹 평균 대비", value: qcGroupDiff, higherIsBetter: false },
          ]}
          onDetailClick={() => onNavigate("qc")}
        />
        <MypageSummaryCard
          title="상담 평점"
          icon={Star}
          headerColor="bg-[#2c6edb]"
          mainValue={(data?.csatScore ?? 0).toFixed(1)}
          mainSuffix="점"
          comparisons={[
            { label: "전월 대비", value: csatPrevDiff, higherIsBetter: true, suffix: "점" },
            { label: "그룹 평균 대비", value: csatGroupDiff, higherIsBetter: true, suffix: "점" },
          ]}
          onDetailClick={() => onNavigate("csat")}
        />
        <MypageSummaryCard
          title="QA 평가"
          icon={ClipboardCheck}
          headerColor="bg-[#4A6FA5]"
          mainValue={(data?.qaScore ?? 0).toFixed(1)}
          mainSuffix="점"
          comparisons={[
            { label: "전월 대비", value: qaPrevDiff, higherIsBetter: true, suffix: "점" },
            { label: "그룹 평균 대비", value: qaGroupDiff, higherIsBetter: true, suffix: "점" },
          ]}
          onDetailClick={() => onNavigate("qa")}
        />
        <MypageSummaryCard
          title="업무지식 테스트"
          icon={BookOpen}
          headerColor="bg-[#6B93D6]"
          mainValue={(data?.quizScore ?? 0).toFixed(1)}
          mainSuffix="점"
          comparisons={[
            { label: "전월 대비", value: quizPrevDiff, higherIsBetter: true, suffix: "점" },
            { label: "그룹 평균 대비", value: quizGroupDiff, higherIsBetter: true, suffix: "점" },
          ]}
          onDetailClick={() => onNavigate("quiz")}
        />
      </div>

      {/* Trend Chart */}
      <MypageTrendChart data={data?.trendData ?? []} />
    </div>
  )
}
