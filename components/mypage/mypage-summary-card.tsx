"use client"

import { cn } from "@/lib/utils"
import { ArrowUpRight, ArrowDownRight, ChevronRight } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface ComparisonItem {
  label: string
  value: number
  /** true = 높을수록 좋음 (점수), false = 낮을수록 좋음 (오류율) */
  higherIsBetter?: boolean
  suffix?: string
}

interface MypageSummaryCardProps {
  title: string
  icon: LucideIcon
  headerColor: string // tailwind bg class e.g. "bg-slate-900"
  mainValue: string
  mainSuffix?: string
  comparisons: ComparisonItem[]
  onDetailClick: () => void
}

export function MypageSummaryCard({
  title,
  icon: Icon,
  headerColor,
  mainValue,
  mainSuffix = "",
  comparisons,
  onDetailClick,
}: MypageSummaryCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* 컬러 헤더 */}
      <div className={cn("px-4 py-3 flex items-center gap-2", headerColor)}>
        <Icon className="h-4 w-4 text-white" />
        <span className="text-sm font-medium text-white">{title}</span>
      </div>

      {/* 본문 */}
      <div className="p-4">
        <div className="text-3xl font-bold text-slate-900 tabular-nums mb-3">
          {mainValue}
          {mainSuffix && (
            <span className="text-sm font-normal text-slate-400 ml-1">{mainSuffix}</span>
          )}
        </div>

        {/* 비교 지표 */}
        <div className="space-y-1.5">
          {comparisons.map((c, i) => {
            const isPositive = c.higherIsBetter ? c.value > 0 : c.value < 0
            const isNeutral = c.value === 0
            const suffix = c.suffix || (c.higherIsBetter ? "점" : "%p")
            return (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{c.label}</span>
                {isNeutral ? (
                  <span className="text-slate-400">-</span>
                ) : (
                  <span className={cn("flex items-center gap-0.5", isPositive ? "text-emerald-600" : "text-red-500")}>
                    {isPositive ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                    {c.value > 0 ? "+" : ""}{c.value.toFixed(1)}{suffix}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* 상세보기 버튼 */}
        <button
          onClick={onDetailClick}
          className="mt-4 w-full flex items-center justify-center gap-1 py-2 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          상세 데이터 보기
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
