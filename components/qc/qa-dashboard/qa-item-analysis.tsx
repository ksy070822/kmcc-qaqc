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

// 달성율 기반 색상 (QC 스타일 MODI 톤)
function getBarColor(rate: number): string {
  if (rate >= 95) return "#1A3D7C"  // 다크 네이비
  if (rate >= 90) return "#1A5FCC"  // 네이비
  if (rate >= 85) return "#337FFF"  // 블루
  return "#85B5FF"                   // 라이트 블루
}

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

  // 일반 항목 (가점/감점 제외), 감점 큰 순
  const normalItems = byChannel.filter(d => !isSpecial(d) && d.maxScore > 0)
  const sortedByDeduction = [...normalItems].sort((a, b) =>
    (b.maxScore - b.avgScore) - (a.maxScore - a.avgScore)
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          항목별 배점 대비 획득 점수 · 감점 큰 순
        </p>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(["유선", "채팅"] as const).map(ch => (
            <button
              key={ch}
              onClick={() => setChannelView(ch)}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                channelView === ch
                  ? "bg-[#337FFF] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      {/* CSS 바 차트 (QC 스타일 통일) */}
      <div className="space-y-2.5">
        {sortedByDeduction.map((item, i) => {
          const pct = Math.min((item.avgScore / item.maxScore) * 100, 100)
          const deduction = item.maxScore - item.avgScore
          const color = getBarColor(item.avgRate)
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-right text-[12px] text-slate-600">
                {item.shortName || item.itemName}
              </span>
              <div className="flex-1 h-5 bg-slate-100 rounded relative group">
                <div
                  className="h-full rounded transition-all"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
                {/* hover 시 상세 툴팁 */}
                <div className="absolute hidden group-hover:block -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                  {item.itemName} · 배점 {item.maxScore} · 평균 {item.avgScore.toFixed(1)} · 감점 {deduction.toFixed(2)}
                </div>
              </div>
              <span className="w-24 shrink-0 text-right text-xs tabular-nums">
                <span className="font-medium text-slate-700">{item.avgScore.toFixed(1)}</span>
                <span className="text-slate-400">/{item.maxScore}</span>
                {deduction >= 1 && (
                  <span className="text-[10px] text-slate-400 ml-1">(-{deduction.toFixed(1)})</span>
                )}
              </span>
            </div>
          )
        })}
      </div>

      {/* 상세 테이블 */}
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
            {sortedByDeduction.map((item, i) => {
              const deduction = item.maxScore - item.avgScore
              const rate = item.avgRate
              return (
                <tr key={i}>
                  <td className="text-left">{item.itemName}</td>
                  <td>{item.maxScore}</td>
                  <td className="font-medium">{item.avgScore.toFixed(1)}</td>
                  <td>
                    <span className="font-medium" style={{ color: getBarColor(rate) }}>
                      {rate.toFixed(1)}%
                    </span>
                  </td>
                  <td>
                    <span className={cn("font-medium",
                      deduction >= 2 ? "text-[#1A3D7C]" :
                      deduction >= 1 ? "text-[#1A5FCC]" :
                      "text-[#B3B3B3]"
                    )}>
                      {deduction.toFixed(2)}
                    </span>
                  </td>
                </tr>
              )
            })}

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

                {/* 칭찬접수 */}
                <tr className="bg-blue-50/50">
                  <td className="text-left font-medium text-[#1A5FCC]">칭찬접수</td>
                  <td>+10</td>
                  <td className="font-medium">{special.praiseBonus.count}건</td>
                  <td />
                  <td><span className="font-medium text-[#1A5FCC]">+{special.praiseBonus.sum.toFixed(1)}</span></td>
                </tr>

                {/* 유선: 호칭오류 */}
                {channelView === "유선" && (
                  <tr>
                    <td className="text-left font-medium text-gray-700">호칭오류</td>
                    <td>-1</td>
                    <td className="font-medium">{special.honorificError.count}건</td>
                    <td />
                    <td><span className="font-medium text-gray-500">{special.honorificError.sum.toFixed(1)}</span></td>
                  </tr>
                )}

                {/* 채팅: 복사오류, 조작오류 */}
                {channelView === "채팅" && (
                  <>
                    <tr>
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
    </div>
  )
}
