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

// QC 차트와 동일한 색상 톤
const BAR_COLOR = "#6B93D6"   // QC 상담태도 블루-그레이
const BAR_COLOR_B = "#9E9E9E" // QC 오상담 그레이

type ChannelView = "유선" | "채팅"

export function QAItemAnalysis({ center, service, channel, tenure, startMonth, endMonth }: Props) {
  const [data, setData] = useState<ItemData[]>([])
  const [special, setSpecial] = useState<SpecialItems | null>(null)
  const [loading, setLoading] = useState(true)
  const [channelView, setChannelView] = useState<ChannelView>("유선")

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

  // 카테고리별 그룹 + 감점 큰 순 (QC 차트 스타일)
  const categories = [...new Set(normalItems.map(d => d.category))].filter(Boolean)
  const grouped = categories.map((cat, idx) => ({
    category: cat,
    color: idx === 0 ? BAR_COLOR : BAR_COLOR_B,
    dotCls: idx === 0 ? "bg-[#6B93D6]" : "bg-[#9E9E9E]",
    textCls: idx === 0 ? "text-[#6B93D6]" : "text-[#9E9E9E]",
    items: normalItems.filter(d => d.category === cat).sort((a, b) =>
      (b.maxScore - b.avgScore) - (a.maxScore - a.avgScore)
    ),
  }))
  const uncategorized = normalItems.filter(d => !d.category)
  if (uncategorized.length > 0) {
    grouped.push({
      category: "기타",
      color: BAR_COLOR_B,
      dotCls: "bg-[#9E9E9E]",
      textCls: "text-[#9E9E9E]",
      items: uncategorized.sort((a, b) => (b.maxScore - b.avgScore) - (a.maxScore - a.avgScore)),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          항목별 배점 대비 획득 점수 · 카테고리별 감점 큰 순
        </p>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(["유선", "채팅"] as const).map(ch => (
            <button
              key={ch}
              onClick={() => setChannelView(ch)}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                channelView === ch
                  ? "bg-[#6B93D6] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      {/* 카테고리별 가로 바 차트 (QC 차트 스타일) */}
      <div className="space-y-8">
        {grouped.map(({ category, color, dotCls, textCls, items }) => (
          <div key={category}>
            <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <span className={cn("w-3 h-3 rounded-full", dotCls)} />
              {category} ({items.length}개 항목)
            </h4>
            <div className="space-y-3">
              {items.map((item, i) => {
                const pct = Math.min((item.avgScore / item.maxScore) * 100, 100)
                const deduction = item.maxScore - item.avgScore
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-right text-[12px] text-slate-600">
                      {item.shortName || item.itemName}
                    </span>
                    <div className="flex-1 h-5 bg-slate-100 rounded relative group">
                      <div
                        className="h-full rounded transition-all"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                      <div className="absolute hidden group-hover:block -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                        {item.itemName} · 배점 {item.maxScore} · 평균 {item.avgScore.toFixed(1)} · 감점 {deduction.toFixed(2)}
                      </div>
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs font-medium text-slate-700 tabular-nums">
                      {item.avgScore.toFixed(1)}/{item.maxScore}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 상세 테이블 (QC 스타일) */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-left">항목</th>
              <th>배점</th>
              <th>평균</th>
              <th>달성율</th>
              <th>감점</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ category, color, textCls, items }) => (
              <>
                {items.map((item, i) => {
                  const deduction = item.maxScore - item.avgScore
                  return (
                    <tr key={`${category}-${i}`}>
                      <td className="text-left font-medium">
                        <span style={{ color }} className="mr-1">&#9679;</span>
                        {item.itemName}
                      </td>
                      <td>{item.maxScore}</td>
                      <td className="font-semibold">{item.avgScore.toFixed(1)}</td>
                      <td>
                        <span className="font-medium" style={{ color }}>
                          {item.avgRate.toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        <span className={cn("font-medium",
                          deduction >= 2 ? "text-red-600" :
                          deduction >= 1 ? "text-slate-600" :
                          "text-slate-400"
                        )}>
                          {deduction.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {/* 카테고리 소계 */}
                <tr className={cn("font-bold", grouped.indexOf({ category, color, textCls, items } as never) === 0 ? "bg-blue-50" : "bg-gray-50")}>
                  <td className={cn("text-left", textCls)}>
                    {category} 소계
                  </td>
                  <td className={textCls}>{items.reduce((s, d) => s + d.maxScore, 0)}</td>
                  <td className={textCls}>{items.reduce((s, d) => s + d.avgScore, 0).toFixed(1)}</td>
                  <td />
                  <td className={textCls}>{items.reduce((s, d) => s + (d.maxScore - d.avgScore), 0).toFixed(2)}</td>
                </tr>
              </>
            ))}

            {/* 구분선 + 가점/감점 */}
            {special && (
              <>
                <tr>
                  <td colSpan={5} className="!py-0.5 !px-0">
                    <div className="border-t-2 border-dashed border-gray-200" />
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} className="text-left !text-[10px] text-gray-400 !py-1">
                    가점 · 감점 항목 ({special.totalEvals}건 평가 기준)
                  </td>
                </tr>

                <tr className="bg-blue-50/50">
                  <td className="text-left font-medium text-[#6B93D6]">칭찬접수</td>
                  <td>+10</td>
                  <td className="font-medium">{special.praiseBonus.count}건</td>
                  <td />
                  <td><span className="font-medium text-[#6B93D6]">+{special.praiseBonus.sum.toFixed(1)}</span></td>
                </tr>

                {channelView === "유선" && (
                  <tr>
                    <td className="text-left font-medium text-gray-700">호칭오류</td>
                    <td>-1</td>
                    <td className="font-medium">{special.honorificError.count}건</td>
                    <td />
                    <td><span className="font-medium text-gray-600">{special.honorificError.sum.toFixed(1)}</span></td>
                  </tr>
                )}

                {channelView === "채팅" && (
                  <>
                    <tr>
                      <td className="text-left font-medium text-gray-700">복사오류</td>
                      <td>-1</td>
                      <td className="font-medium">{special.copyError.count}건</td>
                      <td />
                      <td><span className="font-medium text-gray-600">{special.copyError.sum.toFixed(1)}</span></td>
                    </tr>
                    <tr>
                      <td className="text-left font-medium text-gray-700">조작오류</td>
                      <td>-1</td>
                      <td className="font-medium">{special.operationError.count}건</td>
                      <td />
                      <td><span className="font-medium text-gray-600">{special.operationError.sum.toFixed(1)}</span></td>
                    </tr>
                  </>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
