"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MypageSummaryCard } from "@/components/mypage/mypage-summary-card"
import { MypageTrendChart } from "@/components/mypage/mypage-trend-chart"
import { useMypageContext } from "@/contexts/mypage-context"
import type { UserInfo } from "@/lib/auth"
import type { AgentProductivityData } from "@/lib/types"
import { ShieldCheck, Star, ClipboardCheck, BookOpen, Loader2, Phone, MessageSquare, Clock, Headphones } from "lucide-react"

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
  const { baseMetrics: data, profileLoading: loading } = useMypageContext()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">데이터를 불러오는 중...</span>
      </div>
    )
  }

  // 신규 상담사: 모든 지표가 0/null이고 트렌드 데이터도 비어있으면 빈 상태 표시
  const hasNoData = data && (
    data.qcRate === 0 && data.qcPrevRate === 0 && data.qcGroupAvg === 0 &&
    data.csatScore === 0 && data.csatPrevScore === 0 && data.csatGroupAvg === 0 &&
    data.qaScore === 0 && data.qaPrevScore === 0 && data.qaGroupAvg === 0 &&
    data.quizScore === 0 && data.quizPrevScore === 0 && data.quizGroupAvg === 0 &&
    (!data.trendData || data.trendData.length === 0 || data.trendData.every(t =>
      (t.qcRate === null || t.qcRate === 0) &&
      (t.csatScore === null || t.csatScore === 0) &&
      (t.qaScore === null || t.qaScore === 0) &&
      (t.quizScore === null || t.quizScore === 0)
    ))
  )

  const isVoiceAgent = user?.channel === "유선"
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
            {user?.userId ? `${user.userId} / ${user.userName ?? user.userId}` : "상담사"}님, 반갑습니다!
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {user?.center && <span>{user.center} · </span>}통합 품질 성과 현황을 확인하세요
          </p>
        </div>
        <Badge variant="outline" className={level.color}>
          {level.label}
        </Badge>
      </div>

      {/* 데이터 없는 신규 상담사 안내 */}
      {hasNoData && (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-slate-500">평가 데이터가 아직 없습니다</p>
            <p className="text-xs text-slate-400 mt-1">평가가 완료되면 이곳에 성과 현황이 표시됩니다.</p>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards — 유선은 CSAT 없이 3장, 채팅은 4장 */}
      {!hasNoData && (
        <div className={`grid grid-cols-1 md:grid-cols-2 ${isVoiceAgent ? "lg:grid-cols-3" : "lg:grid-cols-4"} gap-4`}>
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
          {!isVoiceAgent && (
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
          )}
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
      )}

      {/* 나의 생산성 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" />
            나의 생산성
          </h2>
          <button
            onClick={() => onNavigate("productivity")}
            className="text-[11px] font-medium text-slate-500 hover:text-blue-600 flex items-center gap-0.5 transition-colors"
          >
            상세 보기 →
          </button>
        </div>
        <ProductivityPreview channel={user?.channel ?? null} />
      </div>

      {/* Trend Chart */}
      <MypageTrendChart data={data?.trendData ?? []} hideCSAT={isVoiceAgent} />
    </div>
  )
}

/** 메인 뷰용 생산성 미리보기 (개인 ATT/ACW/AHT) */
function ProductivityPreview({ channel }: { channel: string | null }) {
  const [data, setData] = useState<AgentProductivityData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/mypage/productivity")
      const json = await res.json()
      if (json.success && json.data) setData(json.data)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-6 flex items-center justify-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">생산성 데이터 로딩 중...</span>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="py-6 text-center">
          <p className="text-xs text-slate-400">생산성 데이터가 없습니다</p>
        </CardContent>
      </Card>
    )
  }

  const fmtSec = (sec: number) => {
    if (!sec || sec <= 0) return "0:00"
    const m = Math.floor(sec / 60)
    const s = Math.round(sec % 60)
    return `${m}:${String(s).padStart(2, "0")}`
  }

  const isVoice = data.channel === "유선"
  const ChannelIcon = isVoice ? Phone : MessageSquare
  const avg = data.monthAvg

  return (
    <div className="grid grid-cols-4 gap-3">
      <Card>
        <CardContent className="pt-3 pb-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Headphones className="h-3 w-3 text-emerald-500" />
            <span className="text-[10px] text-slate-500">응대건수</span>
          </div>
          <span className="text-lg font-bold text-slate-900 tabular-nums">{avg.answered}<span className="text-[10px] font-normal text-slate-400 ml-0.5">건</span></span>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-3 pb-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <ChannelIcon className="h-3 w-3 text-indigo-500" />
            <span className="text-[10px] text-slate-500">ATT</span>
          </div>
          <span className="text-lg font-bold text-slate-900 tabular-nums">{fmtSec(avg.attSec)}</span>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-3 pb-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="h-3 w-3 text-amber-500" />
            <span className="text-[10px] text-slate-500">ACW</span>
          </div>
          <span className="text-lg font-bold text-slate-900 tabular-nums">{fmtSec(avg.acwSec)}</span>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-3 pb-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="h-3 w-3 text-cyan-500" />
            <span className="text-[10px] text-slate-500">AHT</span>
          </div>
          <span className="text-lg font-bold text-cyan-700 tabular-nums">{fmtSec(avg.ahtSec)}</span>
        </CardContent>
      </Card>
    </div>
  )
}
