"use client"

import type { QuizDashboardStats } from "@/lib/types"
import { cn } from "@/lib/utils"

interface Props {
  stats: QuizDashboardStats | null
  /** 관리자 스코핑: "용산" | "광주" 지정 시 단일 센터 뷰 */
  scopeCenter?: string
}

export function QuizOverviewSection({ stats, scopeCenter }: Props) {
  const s = stats || {
    avgScore: 0, totalSubmissions: 0, uniqueAgents: 0, passRate: 0,
    yongsanAvgScore: 0, gwangjuAvgScore: 0,
  }

  const isScoped = !!scopeCenter
  const isYongsan = scopeCenter === "용산"
  const diff = Math.abs((s.yongsanAvgScore || 0) - (s.gwangjuAvgScore || 0))
  const higherCenter = (s.yongsanAvgScore || 0) >= (s.gwangjuAvgScore || 0) ? "용산" : "광주"

  const scoreColor = (score: number) =>
    score >= 90 ? "text-emerald-600" : score >= 70 ? "text-amber-600" : "text-red-600"

  return (
    <div className="space-y-3">
      {/* 센터 평균 카드 */}
      <div className={cn("grid gap-4", isScoped ? "md:grid-cols-3" : "md:grid-cols-4")}>
        {/* 용산 평균 — 스코핑 시 해당 센터만 */}
        {(!isScoped || isYongsan) && (
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">{isScoped ? "센터 평균" : "용산 평균"}</p>
            <p className={cn("text-2xl font-bold tabular-nums", scoreColor(s.yongsanAvgScore || 0))}>
              {(s.yongsanAvgScore || 0).toFixed(1)}<span className="text-sm font-normal text-gray-400">점</span>
            </p>
          </div>
        )}

        {/* 광주 평균 */}
        {(!isScoped || !isYongsan) && (
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">{isScoped ? "센터 평균" : "광주 평균"} {!isScoped && <span className="text-[10px] text-gray-400">(2회 평균)</span>}</p>
            <p className={cn("text-2xl font-bold tabular-nums", scoreColor(s.gwangjuAvgScore || 0))}>
              {(s.gwangjuAvgScore || 0).toFixed(1)}<span className="text-sm font-normal text-gray-400">점</span>
            </p>
          </div>
        )}

        {/* 전체 평균 */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">전체 평균</p>
          <p className={cn("text-2xl font-bold tabular-nums", scoreColor(s.avgScore))}>
            {s.avgScore.toFixed(1)}<span className="text-sm font-normal text-gray-400">점</span>
          </p>
          {s.scoreTrend !== undefined && (
            <p className={cn("text-xs mt-1", s.scoreTrend > 0 ? "text-emerald-600" : s.scoreTrend < 0 ? "text-red-600" : "text-gray-400")}>
              전월 대비 {s.scoreTrend > 0 ? "+" : ""}{s.scoreTrend.toFixed(1)}점
            </p>
          )}
        </div>

        {/* 합격률 + 응시 */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">합격률 <span className="text-[10px] text-gray-400">(90점 이상)</span></p>
          <p className={cn("text-2xl font-bold tabular-nums", s.passRate >= 90 ? "text-emerald-600" : "text-amber-600")}>
            {s.passRate.toFixed(1)}<span className="text-sm font-normal text-gray-400">%</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            {s.uniqueAgents}명 · {s.totalSubmissions}건
          </p>
        </div>
      </div>

      {/* 센터간 차이 바 — 스코핑 시 숨김 */}
      {!isScoped && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500">센터간 차이</span>
            <span className="text-lg font-bold text-[#2c6edb] tabular-nums">{diff.toFixed(1)}점</span>
            <span className="text-xs text-gray-400">({higherCenter}이 높음)</span>
          </div>
          <div className="flex items-center gap-6 text-xs">
            <span className="text-gray-500">
              용산 <span className="font-semibold text-gray-700">{(s.yongsanAvgScore || 0).toFixed(1)}</span>
            </span>
            <span className="text-gray-300">vs</span>
            <span className="text-gray-500">
              광주 <span className="font-semibold text-gray-700">{(s.gwangjuAvgScore || 0).toFixed(1)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
