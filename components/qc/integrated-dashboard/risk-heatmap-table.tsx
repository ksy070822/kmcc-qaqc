"use client"

import { useState, useMemo } from "react"
import type { AgentMonthlySummary } from "@/lib/types"
import { RISK_LEVEL_CONFIG } from "@/lib/constants"

interface RiskHeatmapTableProps {
  summaries: AgentMonthlySummary[]
  onAgentClick: (agentId: string) => void
}

type SortKey = "agentName" | "center" | "service" | "channel" | "tenureMonths" | "qaScore" | "qcTotalRate" | "csatAvgScore" | "knowledgeScore" | "compositeRiskScore"
type SortDir = "asc" | "desc"

function getCellColor(domain: string, value: number | undefined | null): string {
  if (value == null) return "bg-gray-50 text-gray-400"

  switch (domain) {
    case "qa":
      if (value >= 85) return "bg-emerald-50 text-emerald-700"
      if (value >= 70) return "bg-amber-50 text-amber-700"
      return "bg-red-50 text-red-700"
    case "qc":
      if (value <= 3.0) return "bg-emerald-50 text-emerald-700"
      if (value <= 5.0) return "bg-amber-50 text-amber-700"
      return "bg-red-50 text-red-700"
    case "csat":
      if (value >= 4.5) return "bg-emerald-50 text-emerald-700"
      if (value >= 3.5) return "bg-amber-50 text-amber-700"
      return "bg-red-50 text-red-700"
    case "quiz":
      if (value >= 80) return "bg-emerald-50 text-emerald-700"
      if (value >= 60) return "bg-amber-50 text-amber-700"
      return "bg-red-50 text-red-700"
    default:
      return ""
  }
}

function formatTenure(months: number | undefined | null): string {
  if (months == null) return "-"
  if (months < 12) return `${months}개월`
  const y = Math.floor(months / 12)
  const m = months % 12
  return m > 0 ? `${y}년${m}개월` : `${y}년`
}

type TenureFilter = "all" | "under1" | "1to2" | "under3" | "3to12" | "over12"

const TENURE_FILTERS: Array<{ id: TenureFilter; label: string; filter: (m: number | undefined | null) => boolean }> = [
  { id: "all", label: "전체", filter: () => true },
  { id: "under1", label: "1개월 미만", filter: (m) => m != null && m < 1 },
  { id: "1to2", label: "1~2개월", filter: (m) => m != null && m >= 1 && m < 2 },
  { id: "under3", label: "2~3개월", filter: (m) => m != null && m >= 2 && m < 3 },
  { id: "3to12", label: "3~12개월", filter: (m) => m != null && m >= 3 && m < 12 },
  { id: "over12", label: "12개월+", filter: (m) => m != null && m >= 12 },
]

export function RiskHeatmapTable({ summaries, onAgentClick }: RiskHeatmapTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("compositeRiskScore")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [search, setSearch] = useState("")
  const [tenureFilter, setTenureFilter] = useState<TenureFilter>("all")

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir(key === "compositeRiskScore" || key === "qcTotalRate" ? "desc" : "asc")
    }
  }

  // 각 근속 필터별 인원수
  const tenureCounts = useMemo(() => {
    const counts: Record<TenureFilter, number> = { all: summaries.length, under1: 0, "1to2": 0, under3: 0, "3to12": 0, over12: 0 }
    for (const s of summaries) {
      const m = s.tenureMonths
      if (m == null) continue
      if (m < 1) counts.under1++
      else if (m < 2) counts["1to2"]++
      else if (m < 3) counts.under3++
      else if (m < 12) counts["3to12"]++
      else counts.over12++
    }
    return counts
  }, [summaries])

  const filtered = useMemo(() => {
    const tf = TENURE_FILTERS.find(t => t.id === tenureFilter)!
    let list = summaries.filter(s => tf.filter(s.tenureMonths))
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.agentId.toLowerCase().includes(q) ||
        (s.agentName || "").toLowerCase().includes(q) ||
        s.center.toLowerCase().includes(q) ||
        (s.service || "").toLowerCase().includes(q) ||
        (s.channel || "").toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      const av = a[sortKey] ?? (sortDir === "asc" ? Infinity : -Infinity)
      const bv = b[sortKey] ?? (sortDir === "asc" ? Infinity : -Infinity)
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
  }, [summaries, sortKey, sortDir, search, tenureFilter])

  const SortHeader = ({ label, field, note, className: cls }: { label: string; field: SortKey; note?: string; className?: string }) => (
    <th
      className={`px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap ${cls || ""}`}
      onClick={() => handleSort(field)}
    >
      {label}
      {note && <span className="text-amber-500 ml-0.5 normal-case">({note})</span>}
      {sortKey === field && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </th>
  )

  const COL_W = "w-[76px]" // QA~등급 균등 너비

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-base font-semibold text-gray-900">상담사 리스크 테이블</h3>
        <div className="flex items-center gap-1">
          {TENURE_FILTERS.map(t => (
            <button
              key={t.id}
              onClick={() => setTenureFilter(t.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                tenureFilter === t.id
                  ? "bg-gray-800 text-white"
                  : "text-gray-500 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {t.label} ({tenureCounts[t.id]})
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="이름/ID/센터/그룹 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
        />
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <SortHeader label="상담사" field="agentName" className="w-[120px] text-left" />
                <SortHeader label="센터" field="center" className="w-[52px]" />
                <SortHeader label="그룹" field="service" className="w-[72px]" />
                <SortHeader label="채널" field="channel" className="w-[52px]" />
                <SortHeader label="근속" field="tenureMonths" className="w-[72px]" />
                <SortHeader label="QA" field="qaScore" className={COL_W} />
                <SortHeader label="QC" field="qcTotalRate" className={COL_W} />
                <SortHeader label="평점" field="csatAvgScore" className={COL_W} />
                <SortHeader label="직무" field="knowledgeScore" className={COL_W} />
                <SortHeader label="리스크" field="compositeRiskScore" className={COL_W} />
                <th className={`px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider ${COL_W}`}>등급</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-sm text-gray-400">
                    데이터가 없습니다
                  </td>
                </tr>
              )}
              {filtered.map(s => {
                const level = s.riskLevel || "low"
                const config = RISK_LEVEL_CONFIG[level]
                const hasQc = s.qcEvalCount != null && s.qcEvalCount > 0

                return (
                  <tr
                    key={s.summaryId}
                    onClick={() => onAgentClick(s.agentId)}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-2 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span className="truncate">{s.agentName || s.agentId}</span>
                        {s.watchTags && s.watchTags.length > 0 && (
                          <>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-200 shrink-0">
                              집중관리
                            </span>
                            {s.watchTags.map(tag => (
                              <span
                                key={tag}
                                className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 shrink-0"
                              >
                                {tag}
                              </span>
                            ))}
                          </>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">{s.agentId}</div>
                    </td>
                    <td className="px-2 py-2 text-sm text-center text-gray-600">{s.center || "-"}</td>
                    <td className="px-2 py-2 text-sm text-center text-gray-600 truncate">{s.service || "-"}</td>
                    <td className="px-2 py-2 text-sm text-center">
                      {s.channel ? (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                          s.channel === "채팅" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                        }`}>
                          {s.channel}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="px-2 py-2 text-sm text-center text-gray-600">
                      {formatTenure(s.tenureMonths)}
                    </td>
                    <td className={`px-2 py-2 text-sm text-center font-medium ${getCellColor("qa", s.qaScore)}`}>
                      {s.qaScore != null ? s.qaScore.toFixed(1) : "-"}
                    </td>
                    <td className={`px-2 py-2 text-sm text-center font-medium ${hasQc ? getCellColor("qc", s.qcTotalRate) : "bg-gray-50 text-gray-400"}`}>
                      {hasQc && s.qcTotalRate != null ? `${s.qcTotalRate.toFixed(2)}%` : "-"}
                    </td>
                    <td className={`px-2 py-2 text-sm text-center font-medium ${
                      s.channel === "유선"
                        ? "bg-gray-50 text-gray-400"
                        : getCellColor("csat", s.csatAvgScore != null && s.csatReviewCount && s.csatReviewCount > 0 ? s.csatAvgScore : undefined)
                    }`}>
                      {s.channel === "유선" ? (
                        <span className="text-gray-300 text-xs" title="유선 채널은 상담평점 없음">미해당</span>
                      ) : s.csatAvgScore != null && s.csatReviewCount && s.csatReviewCount > 0
                        ? s.csatAvgScore.toFixed(2)
                        : "-"}
                    </td>
                    <td className={`px-2 py-2 text-sm text-center font-medium ${
                      s.tenureMonths != null && s.tenureMonths < 2
                        ? "bg-gray-50 text-gray-400"
                        : getCellColor("quiz", s.knowledgeScore)
                    }`}>
                      {s.tenureMonths != null && s.tenureMonths < 2 ? (
                        <span className="text-gray-300 text-xs" title="2개월 미만 신입은 직무테스트 미대상">미해당</span>
                      ) : s.knowledgeScore != null
                        ? s.knowledgeScore.toFixed(0)
                        : "-"}
                    </td>
                    <td className="px-2 py-2 text-sm text-center font-bold">
                      {(s.compositeRiskScore || 0).toFixed(1)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: `${config.color}20`, color: config.color }}
                      >
                        {config.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-400">
        총 {filtered.length}명 | QC 미검수("-") = 정상 (선별 대상 아님) | 상담평점은 채팅 상담사만 해당, 유선은 리뷰 없음
      </p>
    </div>
  )
}
