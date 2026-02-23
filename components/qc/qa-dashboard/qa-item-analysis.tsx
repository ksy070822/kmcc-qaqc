"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  center: string
  service: string
  channel: string
  tenure: string
  startMonth?: string
  endMonth?: string
}

interface ItemData {
  itemName: string
  shortName: string
  maxScore: number
  avgScore: number
  avgRate: number
  category: string
}

interface SpecialItems {
  totalEvals: number
  praiseBonus: { count: number; sum: number }
  honorificError: { count: number; sum: number }
  copyError: { count: number; sum: number }
  operationError: { count: number; sum: number }
}

// 가점/감점 항목 판별
const isBonus = (d: ItemData) => d.itemName === "칭찬접수"
const isPenalty = (d: ItemData) => d.maxScore < 0
const isSpecial = (d: ItemData) => isBonus(d) || isPenalty(d)

type ChannelView = "유선" | "채팅"

export function QAItemAnalysis({ center, service, channel, tenure, startMonth, endMonth }: Props) {
  const [data, setData] = useState<ItemData[]>([])
  const [special, setSpecial] = useState<SpecialItems | null>(null)
  const [loading, setLoading] = useState(true)
  const [channelView, setChannelView] = useState<ChannelView>("유선")
  const [showTable, setShowTable] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ type: "qa-item-stats" })
        if (center !== "all") params.set("center", center)
        if (service !== "all") params.set("service", service)
        params.set("channel", channelView)
        if (tenure !== "all") params.set("tenure", tenure)
        if (startMonth) params.set("startMonth", startMonth.slice(0, 7))
        if (endMonth) params.set("endMonth", endMonth.slice(0, 7))

        const res = await fetch(`/api/data?${params}`)
        const json = await res.json()
        if (json.success && json.data) {
          setData(json.data)
          if (json.specialItems) setSpecial(json.specialItems)
        }
      } catch (err) {
        console.error("QA item stats error:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [center, service, channel, tenure, channelView, startMonth, endMonth])

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
  }

  // 채널뷰에 따라 필터
  const byChannel = data.filter(d => {
    if (channelView === "유선") return d.category !== "채팅전용"
    if (channelView === "채팅") return d.category !== "유선전용"
    return true
  })

  // 일반 항목 (가점/감점 제외)
  const normalItems = byChannel.filter(d => !isSpecial(d) && d.maxScore > 0)

  // 카테고리별 그룹
  const categories = [...new Set(normalItems.map(d => d.category))].filter(Boolean)
  const grouped = categories.map(cat => ({
    category: cat,
    items: normalItems.filter(d => d.category === cat).sort((a, b) =>
      (b.maxScore - b.avgScore) - (a.maxScore - a.avgScore)
    ),
  }))

  // 카테고리 없는 항목
  const uncategorized = normalItems.filter(d => !d.category)
  if (uncategorized.length > 0) {
    grouped.push({
      category: "기타",
      items: uncategorized.sort((a, b) => (b.maxScore - b.avgScore) - (a.maxScore - a.avgScore)),
    })
  }

  // 감점 상위 5개 (전체 기준)
  const topDeductions = [...normalItems]
    .sort((a, b) => (b.maxScore - b.avgScore) - (a.maxScore - a.avgScore))
    .slice(0, 5)
  const topDeductionNames = new Set(topDeductions.map(d => d.itemName))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          항목별 배점 대비 획득 점수 · 카테고리별 감점 큰 순
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTable(v => !v)}
            className={cn(
              "px-2.5 py-1 text-xs rounded-md transition-colors",
              showTable ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-100 border border-gray-200"
            )}
          >
            {showTable ? "차트 보기" : "상세 테이블"}
          </button>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(["유선", "채팅"] as const).map(ch => (
              <button
                key={ch}
                onClick={() => setChannelView(ch)}
                className={cn(
                  "px-3 py-1 text-xs font-medium transition-colors",
                  channelView === ch
                    ? "bg-gray-700 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!showTable ? (
        /* ── 차트 뷰: 카테고리별 그룹 + 감점 강조 바 ── */
        <div className="space-y-5">
          {grouped.map(({ category, items }) => (
            <div key={category}>
              {/* 카테고리 헤더 */}
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{category}</span>
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[10px] text-gray-400">{items.length}개 항목</span>
              </div>

              <div className="space-y-1.5">
                {items.map((item, i) => {
                  const pct = Math.min((item.avgScore / item.maxScore) * 100, 100)
                  const deduction = item.maxScore - item.avgScore
                  const isHighDeduction = topDeductionNames.has(item.itemName)

                  return (
                    <div key={i} className="flex items-center gap-2 group">
                      <span className={cn(
                        "w-[76px] shrink-0 text-right text-[11px] leading-tight",
                        isHighDeduction ? "font-semibold text-gray-800" : "text-gray-500"
                      )}>
                        {item.shortName || item.itemName}
                      </span>

                      {/* 바: 획득(gray) + 감점(rose) */}
                      <div className="flex-1 h-2.5 bg-gray-100 rounded-sm overflow-hidden relative">
                        <div
                          className="h-full rounded-sm transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: isHighDeduction ? "#64748b" : "#94a3b8",
                          }}
                        />
                        {/* 감점 구간 표시 (감점 >= 0.5) */}
                        {deduction >= 0.5 && (
                          <div
                            className="absolute top-0 h-full rounded-sm"
                            style={{
                              left: `${pct}%`,
                              width: `${Math.min(100 - pct, 100)}%`,
                              backgroundColor: isHighDeduction ? "#fda4af" : "#fecdd3",
                              opacity: 0.6,
                            }}
                          />
                        )}
                      </div>

                      {/* 점수 */}
                      <span className="w-[70px] shrink-0 text-right text-[11px] tabular-nums">
                        <span className={cn("font-medium", isHighDeduction ? "text-gray-800" : "text-gray-600")}>
                          {item.avgScore.toFixed(1)}
                        </span>
                        <span className="text-gray-400">/{item.maxScore}</span>
                      </span>

                      {/* 감점 뱃지 (상위 감점만) */}
                      <span className={cn(
                        "w-[38px] shrink-0 text-right text-[10px] tabular-nums",
                        deduction >= 2 ? "text-rose-600 font-semibold" :
                        deduction >= 1 ? "text-rose-400 font-medium" :
                        "text-gray-300"
                      )}>
                        -{deduction.toFixed(1)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* 가점/감점 특수 항목 */}
          {special && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">가점 · 감점</span>
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[10px] text-gray-400">{special.totalEvals}건 평가 기준</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50/70">
                  <span className="text-xs text-gray-600">칭찬접수</span>
                  <span className="text-xs font-semibold text-blue-600">+{special.praiseBonus.sum.toFixed(1)} ({special.praiseBonus.count}건)</span>
                </div>
                {channelView === "유선" && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50">
                    <span className="text-xs text-gray-600">호칭오류</span>
                    <span className="text-xs font-medium text-gray-500">{special.honorificError.sum.toFixed(1)} ({special.honorificError.count}건)</span>
                  </div>
                )}
                {channelView === "채팅" && (
                  <>
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50">
                      <span className="text-xs text-gray-600">복사오류</span>
                      <span className="text-xs font-medium text-gray-500">{special.copyError.sum.toFixed(1)} ({special.copyError.count}건)</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50">
                      <span className="text-xs text-gray-600">조작오류</span>
                      <span className="text-xs font-medium text-gray-500">{special.operationError.sum.toFixed(1)} ({special.operationError.count}건)</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── 테이블 뷰 ── */
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-left">카테고리</th>
                <th className="text-left">항목</th>
                <th>배점</th>
                <th>평균</th>
                <th>달성율</th>
                <th>감점</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(({ category, items }) => (
                items.map((item, i) => {
                  const deduction = item.maxScore - item.avgScore
                  return (
                    <tr key={`${category}-${i}`}>
                      {i === 0 && (
                        <td className="text-left text-xs text-gray-500 font-medium" rowSpan={items.length}>
                          {category}
                        </td>
                      )}
                      <td className="text-left">{item.itemName}</td>
                      <td>{item.maxScore}</td>
                      <td className="font-medium">{item.avgScore.toFixed(1)}</td>
                      <td>
                        <span className={cn("font-medium",
                          item.avgRate >= 95 ? "text-emerald-600" :
                          item.avgRate >= 90 ? "text-gray-700" :
                          "text-rose-600"
                        )}>
                          {item.avgRate.toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        <span className={cn("font-medium",
                          deduction >= 2 ? "text-rose-600" :
                          deduction >= 1 ? "text-rose-400" :
                          "text-gray-400"
                        )}>
                          {deduction.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  )
                })
              ))}

              {/* 가점/감점 */}
              {special && (
                <>
                  <tr>
                    <td colSpan={6} className="!py-0.5 !px-0">
                      <div className="border-t-2 border-dashed border-gray-200" />
                    </td>
                  </tr>
                  <tr className="bg-blue-50/50">
                    <td className="text-left text-xs text-gray-500 font-medium">가점</td>
                    <td className="text-left font-medium text-blue-600">칭찬접수</td>
                    <td>+10</td>
                    <td className="font-medium">{special.praiseBonus.count}건</td>
                    <td />
                    <td><span className="font-medium text-blue-600">+{special.praiseBonus.sum.toFixed(1)}</span></td>
                  </tr>
                  {channelView === "유선" && (
                    <tr>
                      <td className="text-left text-xs text-gray-500 font-medium">감점</td>
                      <td className="text-left font-medium text-gray-700">호칭오류</td>
                      <td>-1</td>
                      <td className="font-medium">{special.honorificError.count}건</td>
                      <td />
                      <td><span className="font-medium text-gray-500">{special.honorificError.sum.toFixed(1)}</span></td>
                    </tr>
                  )}
                  {channelView === "채팅" && (
                    <>
                      <tr>
                        <td className="text-left text-xs text-gray-500 font-medium" rowSpan={2}>감점</td>
                        <td className="text-left font-medium text-gray-700">복사오류</td>
                        <td>-1</td>
                        <td className="font-medium">{special.copyError.count}건</td>
                        <td />
                        <td><span className="font-medium text-gray-500">{special.copyError.sum.toFixed(1)}</span></td>
                      </tr>
                      <tr>
                        <td className="text-left font-medium text-gray-700">조작오류</td>
                        <td>-1</td>
                        <td className="font-medium">{special.operationError.count}건</td>
                        <td />
                        <td><span className="font-medium text-gray-500">{special.operationError.sum.toFixed(1)}</span></td>
                      </tr>
                    </>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
