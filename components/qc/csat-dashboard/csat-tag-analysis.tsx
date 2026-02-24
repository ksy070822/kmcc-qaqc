"use client"

import type { CSATTagRow } from "@/lib/types"

interface Props {
  data: CSATTagRow[]
}

export function CSATTagAnalysis({ data }: Props) {
  // NEGATIVE 태그 필터 (대소문자 무관)
  const negativeTags = (data || []).filter(t => t.optionType?.toUpperCase() === "NEGATIVE")

  if (negativeTags.length === 0) {
    // 디버그: 실제 어떤 optionType이 있는지 표시
    const types = [...new Set((data || []).map(t => t.optionType))]
    return (
      <div className="text-center text-muted-foreground text-xs py-8">
        부정태그 데이터가 없습니다
        {data && data.length > 0 && (
          <p className="mt-1 text-[10px]">전체 태그 {data.length}건 (유형: {types.join(", ") || "없음"})</p>
        )}
      </div>
    )
  }

  const totalNegative = negativeTags.reduce((s, t) => s + t.count, 0)
  const maxCount = negativeTags[0]?.count || 1

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          총 부정태그 <span className="font-semibold text-foreground">{totalNegative.toLocaleString("ko-KR")}건</span>
        </p>
      </div>
      <div className="space-y-2">
        {negativeTags.map((tag, i) => {
          const rate = totalNegative > 0 ? (tag.count / totalNegative) * 100 : 0
          const barWidth = (tag.count / maxCount) * 100

          return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs w-[120px] truncate shrink-0 text-right" title={tag.tag}>
                {tag.tag}
              </span>
              <div className="flex-1 h-5 bg-slate-100 rounded-sm overflow-hidden relative">
                <div
                  className="h-full bg-red-400 rounded-sm transition-all"
                  style={{ width: `${barWidth}%` }}
                />
                <span className="absolute inset-y-0 right-1 flex items-center text-[10px] text-slate-600">
                  {tag.count}건
                </span>
              </div>
              <span className="text-xs w-12 text-right text-muted-foreground shrink-0">
                {rate.toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
