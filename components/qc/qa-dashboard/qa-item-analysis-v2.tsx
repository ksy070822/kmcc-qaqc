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

// MODI 색상 토큰
const MODI = {
  brandPrimary: "#005FFF",
  brandWarning: "#DD2222",
  textPrimary: "#121212",
  textSecondary: "#4D4D4D",
  textTertiary: "#666666",
  textPlaceholder: "#808080",
  bgSecondary: "#F7F7F7",
  bgAccentBlue: "#F0F5FF",
  bgAccentBlueOp: "#005FFF14",
  stroke: "#D9D9D9",
}

type ChannelView = "유선" | "채팅"

export function QAItemAnalysisV2({ center, service, channel, tenure, startMonth, endMonth }: Props) {
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

  // 카테고리별 그룹, 감점 큰 순
  const categories = [...new Set(normalItems.map(d => d.category))].filter(Boolean)
  const grouped = categories.map(cat => ({
    category: cat,
    items: normalItems.filter(d => d.category === cat).sort((a, b) =>
      (b.maxScore - b.avgScore) - (a.maxScore - a.avgScore)
    ),
  }))

  const uncategorized = normalItems.filter(d => !d.category)
  if (uncategorized.length > 0) {
    grouped.push({
      category: "기타",
      items: uncategorized.sort((a, b) => (b.maxScore - b.avgScore) - (a.maxScore - a.avgScore)),
    })
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: MODI.textTertiary }}>
          항목별 배점 대비 획득 점수 · 감점 큰 순 · 통합 테이블 뷰
        </p>
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${MODI.stroke}` }}>
          {(["유선", "채팅"] as const).map(ch => (
            <button
              key={ch}
              onClick={() => setChannelView(ch)}
              className="px-3 py-1 text-xs font-medium transition-colors"
              style={{
                backgroundColor: channelView === ch ? MODI.textSecondary : "#fff",
                color: channelView === ch ? "#fff" : MODI.textTertiary,
              }}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      {/* 통합 테이블 (인라인 미니바 포함) */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${MODI.stroke}` }}>
              <th className="text-left py-2 px-3 text-xs font-semibold" style={{ color: MODI.textTertiary, width: 100 }}>항목</th>
              <th className="py-2 px-2 text-xs font-semibold text-center" style={{ color: MODI.textTertiary, width: 200 }}>달성 현황</th>
              <th className="py-2 px-2 text-xs font-semibold text-center" style={{ color: MODI.textTertiary, width: 56 }}>점수</th>
              <th className="py-2 px-2 text-xs font-semibold text-center" style={{ color: MODI.textTertiary, width: 56 }}>달성율</th>
              <th className="py-2 px-2 text-xs font-semibold text-center" style={{ color: MODI.textTertiary, width: 50 }}>감점</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ category, items }, gi) => (
              <>
                {/* 카테고리 구분 행 */}
                <tr key={`cat-${gi}`}>
                  <td
                    colSpan={5}
                    className="pt-4 pb-1.5 px-3"
                    style={{ borderBottom: `1px solid ${MODI.stroke}` }}
                  >
                    <span className="text-xs font-semibold" style={{ color: MODI.textSecondary }}>
                      {category}
                    </span>
                    <span className="text-[10px] ml-2" style={{ color: MODI.textPlaceholder }}>
                      {items.length}개 항목
                    </span>
                  </td>
                </tr>

                {items.map((item, i) => {
                  const pct = Math.min((item.avgScore / item.maxScore) * 100, 100)
                  const deduction = item.maxScore - item.avgScore
                  const isWarn = deduction >= 2

                  return (
                    <tr
                      key={`${gi}-${i}`}
                      className="group transition-colors"
                      style={{
                        borderBottom: `1px solid ${i === items.length - 1 ? "transparent" : "#F0F0F0"}`,
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = MODI.bgAccentBlueOp}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      {/* 항목명 */}
                      <td className="py-2.5 px-3 text-left">
                        <span
                          className={cn("text-[12px]", isWarn ? "font-semibold" : "font-normal")}
                          style={{ color: isWarn ? MODI.textPrimary : MODI.textSecondary }}
                        >
                          {item.shortName || item.itemName}
                        </span>
                      </td>

                      {/* 인라인 미니바 */}
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="flex-1 h-[6px] rounded-full overflow-hidden"
                            style={{ backgroundColor: MODI.bgSecondary }}
                          >
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: isWarn ? MODI.brandPrimary : `${MODI.brandPrimary}80`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] w-[28px] text-right tabular-nums shrink-0" style={{ color: MODI.textPlaceholder }}>
                            {item.maxScore}
                          </span>
                        </div>
                      </td>

                      {/* 점수 */}
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className="text-xs font-medium tabular-nums"
                          style={{ color: isWarn ? MODI.textPrimary : MODI.textSecondary }}
                        >
                          {item.avgScore.toFixed(1)}
                        </span>
                      </td>

                      {/* 달성율 */}
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className="text-xs tabular-nums"
                          style={{
                            color: item.avgRate >= 95 ? MODI.brandPrimary
                              : item.avgRate < 85 ? MODI.brandWarning
                              : MODI.textTertiary,
                            fontWeight: item.avgRate < 85 ? 600 : 400,
                          }}
                        >
                          {item.avgRate.toFixed(1)}%
                        </span>
                      </td>

                      {/* 감점 */}
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className="text-xs tabular-nums"
                          style={{
                            color: deduction >= 2 ? MODI.brandWarning
                              : deduction >= 0.5 ? MODI.textTertiary
                              : MODI.stroke,
                            fontWeight: deduction >= 2 ? 700 : 400,
                          }}
                        >
                          {deduction >= 0.01 ? `-${deduction.toFixed(1)}` : "-"}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </>
            ))}

            {/* 가점/감점 특수 항목 */}
            {special && (
              <>
                <tr>
                  <td colSpan={5} className="pt-4 pb-1.5 px-3" style={{ borderBottom: `1px solid ${MODI.stroke}` }}>
                    <span className="text-xs font-semibold" style={{ color: MODI.textSecondary }}>
                      가점 · 감점
                    </span>
                    <span className="text-[10px] ml-2" style={{ color: MODI.textPlaceholder }}>
                      {special.totalEvals}건 평가 기준
                    </span>
                  </td>
                </tr>

                <tr style={{ backgroundColor: MODI.bgAccentBlue }}>
                  <td className="py-2.5 px-3 text-left">
                    <span className="text-xs font-medium" style={{ color: MODI.brandPrimary }}>칭찬접수</span>
                  </td>
                  <td className="py-2.5 px-2" colSpan={2}>
                    <span className="text-xs" style={{ color: MODI.textTertiary }}>{special.praiseBonus.count}건 접수</span>
                  </td>
                  <td className="py-2.5 px-2 text-center" colSpan={2}>
                    <span className="text-xs font-semibold" style={{ color: MODI.brandPrimary }}>+{special.praiseBonus.sum.toFixed(1)}</span>
                  </td>
                </tr>

                {channelView === "유선" && (
                  <tr>
                    <td className="py-2.5 px-3 text-left">
                      <span className="text-xs" style={{ color: MODI.textSecondary }}>호칭오류</span>
                    </td>
                    <td className="py-2.5 px-2" colSpan={2}>
                      <span className="text-xs" style={{ color: MODI.textTertiary }}>{special.honorificError.count}건</span>
                    </td>
                    <td className="py-2.5 px-2 text-center" colSpan={2}>
                      <span className="text-xs" style={{ color: MODI.textTertiary }}>{special.honorificError.sum.toFixed(1)}</span>
                    </td>
                  </tr>
                )}

                {channelView === "채팅" && (
                  <>
                    <tr>
                      <td className="py-2.5 px-3 text-left">
                        <span className="text-xs" style={{ color: MODI.textSecondary }}>복사오류</span>
                      </td>
                      <td className="py-2.5 px-2" colSpan={2}>
                        <span className="text-xs" style={{ color: MODI.textTertiary }}>{special.copyError.count}건</span>
                      </td>
                      <td className="py-2.5 px-2 text-center" colSpan={2}>
                        <span className="text-xs" style={{ color: MODI.textTertiary }}>{special.copyError.sum.toFixed(1)}</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-left">
                        <span className="text-xs" style={{ color: MODI.textSecondary }}>조작오류</span>
                      </td>
                      <td className="py-2.5 px-2" colSpan={2}>
                        <span className="text-xs" style={{ color: MODI.textTertiary }}>{special.operationError.count}건</span>
                      </td>
                      <td className="py-2.5 px-2 text-center" colSpan={2}>
                        <span className="text-xs" style={{ color: MODI.textTertiary }}>{special.operationError.sum.toFixed(1)}</span>
                      </td>
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
