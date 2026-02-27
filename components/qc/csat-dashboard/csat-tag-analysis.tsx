"use client"

import type { CSATTagRow } from "@/lib/types"
import { CSAT_TAG_LABELS } from "@/lib/constants"

interface Props {
  data: CSATTagRow[]
}

function getTagLabel(tag: string): string {
  return CSAT_TAG_LABELS[tag] || tag
}

export function CSATTagAnalysis({ data }: Props) {
  const positiveTags = (data || []).filter(t => t.optionType?.toUpperCase() === "POSITIVE")
  const negativeTags = (data || []).filter(t => t.optionType?.toUpperCase() === "NEGATIVE")

  if (positiveTags.length === 0 && negativeTags.length === 0) {
    const types = [...new Set((data || []).map(t => t.optionType))]
    return (
      <div className="text-center text-muted-foreground text-xs py-8">
        태그 데이터가 없습니다
        {data && data.length > 0 && (
          <p className="mt-1 text-[10px]">전체 태그 {data.length}건 (유형: {types.join(", ") || "없음"})</p>
        )}
      </div>
    )
  }

  const totalPositive = positiveTags.reduce((s, t) => s + t.count, 0)
  const totalNegative = negativeTags.reduce((s, t) => s + t.count, 0)
  const totalAll = totalPositive + totalNegative
  const positiveRate = totalAll > 0 ? (totalPositive / totalAll) * 100 : 0
  const negativeRate = totalAll > 0 ? (totalNegative / totalAll) * 100 : 0

  const maxPositive = positiveTags[0]?.count || 1
  const maxNegative = negativeTags[0]?.count || 1

  return (
    <div className="space-y-5">
      {/* 긍정/부정 비중 요약 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-400" />
          <span className="text-xs">긍정 <span className="font-semibold text-foreground">{totalPositive.toLocaleString("ko-KR")}건</span> ({positiveRate.toFixed(1)}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-red-400" />
          <span className="text-xs">부정 <span className="font-semibold text-foreground">{totalNegative.toLocaleString("ko-KR")}건</span> ({negativeRate.toFixed(1)}%)</span>
        </div>
        {/* 비중 바 */}
        <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden flex">
          <div className="h-full bg-blue-400 transition-all" style={{ width: `${positiveRate}%` }} />
          <div className="h-full bg-red-400 transition-all" style={{ width: `${negativeRate}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 긍정태그 */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-blue-700">긍정태그</p>
          {positiveTags.map((tag, i) => {
            const rate = totalPositive > 0 ? (tag.count / totalPositive) * 100 : 0
            const barWidth = (tag.count / maxPositive) * 100
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs w-[120px] truncate shrink-0 text-right" title={`${tag.tag} (${getTagLabel(tag.tag)})`}>
                  {getTagLabel(tag.tag)}
                </span>
                <div className="flex-1 h-5 bg-slate-100 rounded-sm overflow-hidden relative">
                  <div className="h-full bg-blue-400 rounded-sm transition-all" style={{ width: `${barWidth}%` }} />
                  <span className="absolute inset-y-0 right-1 flex items-center text-[10px] text-slate-600">{tag.count}건</span>
                </div>
                <span className="text-xs w-12 text-right text-muted-foreground shrink-0">{rate.toFixed(1)}%</span>
              </div>
            )
          })}
        </div>

        {/* 부정태그 */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-red-700">부정태그</p>
          {negativeTags.map((tag, i) => {
            const rate = totalNegative > 0 ? (tag.count / totalNegative) * 100 : 0
            const barWidth = (tag.count / maxNegative) * 100
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs w-[120px] truncate shrink-0 text-right" title={`${tag.tag} (${getTagLabel(tag.tag)})`}>
                  {getTagLabel(tag.tag)}
                </span>
                <div className="flex-1 h-5 bg-slate-100 rounded-sm overflow-hidden relative">
                  <div className="h-full bg-red-400 rounded-sm transition-all" style={{ width: `${barWidth}%` }} />
                  <span className="absolute inset-y-0 right-1 flex items-center text-[10px] text-slate-600">{tag.count}건</span>
                </div>
                <span className="text-xs w-12 text-right text-muted-foreground shrink-0">{rate.toFixed(1)}%</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
