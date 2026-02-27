"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Loader2, Search, ChevronRight } from "lucide-react"
import type { AgentSummaryRow } from "@/lib/types"

const SHIFT_OPTIONS = [
  { value: "", label: "전체" },
  { value: "day", label: "주간" },
  { value: "evening", label: "야간" },
  { value: "overnight", label: "심야" },
]

function shiftLabel(shift: string | null): string {
  switch (shift) {
    case "day": return "주간"
    case "evening": return "야간"
    case "overnight": return "심야"
    default: return "-"
  }
}

interface AgentListTableProps {
  data: AgentSummaryRow[]
  loading: boolean
  onSelect: (agentId: string) => void
  // 센터 필터 (본사관리자/강사용, 선택적)
  centerFilter?: string
  onCenterChange?: (center: string) => void
  // 채널 필터 (관리자용, 선택적)
  channelFilter?: string
  onChannelChange?: (channel: string) => void
  // 근무시간대 필터 (관리자용, 선택적)
  shiftFilter?: string
  onShiftChange?: (shift: string) => void
}

export function AgentListTable({
  data, loading, onSelect,
  centerFilter, onCenterChange,
  channelFilter, onChannelChange,
  shiftFilter, onShiftChange,
}: AgentListTableProps) {
  const [search, setSearch] = useState("")

  const showCenterFilter = onCenterChange != null
  const showChannelFilter = onChannelChange != null
  const showShiftFilter = onShiftChange != null

  // 데이터에서 고유 채널 목록 추출
  const channelOptions = useMemo(() => {
    const channels = new Set<string>()
    for (const a of data) {
      if (a.channel) channels.add(a.channel)
    }
    return ["", ...Array.from(channels).sort()]
  }, [data])

  const filtered = useMemo(() => {
    let result = data

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(a =>
        a.agentId.toLowerCase().includes(q) ||
        (a.name && a.name.toLowerCase().includes(q))
      )
    }
    if (channelFilter) {
      result = result.filter(a => a.channel === channelFilter)
    }
    if (shiftFilter) {
      result = result.filter(a => a.shift === shiftFilter)
    }

    return result
  }, [data, search, channelFilter, shiftFilter])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">상담사 목록을 불러오는 중...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="ID 또는 이름 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* 센터 필터 (본사관리자/강사용) */}
        {showCenterFilter && (
          <div className="flex gap-1">
            {["전체", "용산", "광주"].map(c => (
              <button
                key={c}
                onClick={() => onCenterChange!(c === "전체" ? "" : c)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  (c === "전체" && !centerFilter) || centerFilter === c
                    ? "bg-[#2c6edb] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* 채널 필터 */}
        {showChannelFilter && channelOptions.length > 1 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-400 mr-1">채널</span>
            {channelOptions.map(c => (
              <button
                key={c || "__all"}
                onClick={() => onChannelChange!(c)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  channelFilter === c
                    ? "bg-[#1e3a5f] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {c || "전체"}
              </button>
            ))}
          </div>
        )}

        {/* 근무시간대 필터 */}
        {showShiftFilter && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-400 mr-1">시간대</span>
            {SHIFT_OPTIONS.map(s => (
              <button
                key={s.value || "__all"}
                onClick={() => onShiftChange!(s.value)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  shiftFilter === s.value
                    ? "bg-[#1e3a5f] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <span className="text-xs text-slate-400 ml-auto">{filtered.length}명</span>
      </div>

      {/* 테이블 */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left py-2.5 px-4 font-semibold text-slate-700">아이디 / 이름</th>
              {showCenterFilter && <th className="text-center py-2.5 px-3 font-semibold text-slate-700">센터</th>}
              {(showChannelFilter || showShiftFilter) && (
                <th className="text-center py-2.5 px-3 font-semibold text-slate-700">채널</th>
              )}
              {showShiftFilter && (
                <th className="text-center py-2.5 px-3 font-semibold text-slate-700">시간대</th>
              )}
              <th className="text-center py-2.5 px-3 font-semibold text-slate-700">근속</th>
              <th className="text-center py-2.5 px-3 font-semibold text-slate-700">QC 태도</th>
              <th className="text-center py-2.5 px-3 font-semibold text-slate-700">QC 오상담</th>
              <th className="text-center py-2.5 px-3 font-semibold text-slate-700">직무테스트</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={showCenterFilter ? 8 : (showShiftFilter ? 9 : 7)} className="text-center py-12 text-slate-400">
                  {search || channelFilter || shiftFilter ? "검색 결과가 없습니다" : "상담사 데이터가 없습니다"}
                </td>
              </tr>
            ) : (
              filtered.map(agent => (
                <tr
                  key={agent.agentId}
                  onClick={() => onSelect(agent.agentId)}
                  className="border-b border-slate-100 hover:bg-blue-50/50 cursor-pointer transition-colors"
                >
                  <td className="py-2.5 px-4 font-medium text-slate-800">{agent.agentId} / {agent.name || "-"}</td>
                  {showCenterFilter && (
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        agent.center === "용산"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {agent.center}
                      </span>
                    </td>
                  )}
                  {(showChannelFilter || showShiftFilter) && (
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        agent.channel === "유선"
                          ? "bg-indigo-50 text-indigo-700"
                          : agent.channel === "채팅"
                            ? "bg-violet-50 text-violet-700"
                            : "bg-slate-100 text-slate-600"
                      }`}>
                        {agent.channel || "-"}
                      </span>
                    </td>
                  )}
                  {showShiftFilter && (
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        agent.shift === "day"
                          ? "bg-amber-50 text-amber-700"
                          : agent.shift === "evening"
                            ? "bg-blue-50 text-blue-700"
                            : agent.shift === "overnight"
                              ? "bg-slate-700 text-white"
                              : "bg-slate-100 text-slate-500"
                      }`}>
                        {shiftLabel(agent.shift)}
                      </span>
                    </td>
                  )}
                  <td className="py-2.5 px-3 text-center text-slate-600">
                    {agent.tenureMonths > 0 ? `${agent.tenureMonths}M` : "-"}
                  </td>
                  <td className={`py-2.5 px-3 text-center font-medium ${
                    agent.attRate != null && agent.attRate > 3.0 ? "text-red-600" : "text-slate-700"
                  }`}>
                    {agent.attRate != null ? `${agent.attRate.toFixed(1)}%` : "-"}
                  </td>
                  <td className={`py-2.5 px-3 text-center font-medium ${
                    agent.opsRate != null && agent.opsRate > 3.0 ? "text-red-600" : "text-slate-700"
                  }`}>
                    {agent.opsRate != null ? `${agent.opsRate.toFixed(1)}%` : "-"}
                  </td>
                  <td className={`py-2.5 px-3 text-center font-medium ${
                    agent.quizScore != null && agent.quizScore < 90 ? "text-red-600" : "text-slate-700"
                  }`}>
                    {agent.quizScore != null ? `${agent.quizScore.toFixed(1)}` : "-"}
                  </td>
                  <td className="py-2.5 px-2">
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
