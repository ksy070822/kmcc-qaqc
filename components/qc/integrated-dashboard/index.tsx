"use client"

import { useState, useEffect } from "react"
import { format, subMonths } from "date-fns"
import { IntegratedOverview } from "./integrated-overview"
import { RiskHeatmapTable } from "./risk-heatmap-table"
import { AgentProfileModal } from "./agent-profile-modal"
import { CrossDomainInsights } from "./cross-domain-insights"
import { useIntegratedDashboardData, useAgentIntegratedProfile } from "@/lib/use-integrated-data"

interface IntegratedDashboardProps {
  externalMonth?: string
  onNavigateToCoaching?: (agentId: string) => void
}

export function IntegratedDashboard({ externalMonth, onNavigateToCoaching }: IntegratedDashboardProps) {
  // 현재월 기본값
  const [month, setMonth] = useState(() => externalMonth || format(new Date(), "yyyy-MM"))
  const [center, setCenter] = useState<string>("")
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)

  // 외부 월 → 내부 상태 동기화
  useEffect(() => {
    if (externalMonth) setMonth(externalMonth)
  }, [externalMonth])

  const { summaries, stats, crossAnalysis, loading, error, fetchData } = useIntegratedDashboardData(month, center || undefined)
  const { profile, loading: profileLoading, error: profileError, fetchProfile, clearProfile } = useAgentIntegratedProfile()

  // 데이터 fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 상담사 클릭 → 프로파일 모달
  const handleAgentClick = (agentId: string) => {
    setSelectedAgentId(agentId)
    fetchProfile(agentId, 6, month)
  }

  const handleCloseModal = () => {
    setSelectedAgentId(null)
    clearProfile()
  }

  // 월 선택 옵션 (최근 6개월)
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), i)
    return format(d, "yyyy-MM")
  })

  return (
    <div className="space-y-6">
      {/* 필터 바 */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* 외부 월 제공 시 자체 월 선택 숨김 */}
        {!externalMonth && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">월 선택</label>
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {monthOptions.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">센터</label>
          <select
            value={center}
            onChange={e => setCenter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체</option>
            <option value="용산">용산</option>
            <option value="광주">광주</option>
          </select>
        </div>

        <div className="flex-1" />

        <p className="text-xs text-gray-400">
          QA(SLA 핵심) · 직무테스트/상담평점(SLA 합산) · QC(일별 정기활동)
        </p>
      </div>

      {/* 항목별 데이터 커버리지 */}
      {!loading && stats && (
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: "qa", label: "QA (SLA)", count: summaries.filter(s => s.qaScore != null).length },
            { key: "qc", label: "QC", count: summaries.filter(s => s.qcEvalCount && s.qcEvalCount > 0).length },
            { key: "csat", label: "상담평점", count: summaries.filter(s => s.csatReviewCount && s.csatReviewCount > 0).length },
            { key: "quiz", label: "직무테스트", count: summaries.filter(s => s.knowledgeScore != null).length },
          ].map(d => (
            <span
              key={d.key}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                d.count > 0
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-gray-50 text-gray-400 border border-gray-200"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${d.count > 0 ? "bg-emerald-500" : "bg-gray-300"}`} />
              {d.label}: {d.count > 0 ? `${d.count}명` : "데이터 없음"}
            </span>
          ))}
          {summaries.filter(s => s.qaScore != null).length === 0 && (
            <span className="text-xs text-amber-600 ml-1">
              {month}월 QA 미적재 — 다른 월을 선택하세요
            </span>
          )}
        </div>
      )}

      {/* 로딩/에러 */}
      {loading && (
        <div className="text-center py-12 text-gray-400">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          통합 데이터 분석 중...
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 콘텐츠 */}
      {!loading && stats && (
        <>
          {/* Overview KPI */}
          <IntegratedOverview stats={stats} />

          {/* 서비스/채널별 유의상담사 현황 */}
          {summaries.length > 0 && (() => {
            const groupMap = new Map<string, { total: number; medium: number; high: number; critical: number }>()
            for (const s of summaries) {
              const ctr = s.center || "기타"
              const svc = s.service || "기타"
              const ch = s.channel || "-"
              const key = `${ctr}__${svc}__${ch}`
              const entry = groupMap.get(key) || { total: 0, medium: 0, high: 0, critical: 0 }
              entry.total++
              if (s.riskLevel === "medium") entry.medium++
              else if (s.riskLevel === "high") entry.high++
              else if (s.riskLevel === "critical") entry.critical++
              groupMap.set(key, entry)
            }
            const rows = Array.from(groupMap.entries())
              .map(([key, v]) => {
                const [ctr, svc, ch] = key.split("__")
                const risk = v.medium + v.high + v.critical
                return { center: ctr, service: svc, channel: ch, ...v, risk, rate: v.total > 0 ? Math.round((risk / v.total) * 1000) / 10 : 0 }
              })
              .filter(r => r.risk > 0)
              .sort((a, b) => (b.critical * 100 + b.high * 10 + b.medium) - (a.critical * 100 + a.high * 10 + a.medium))
            const totalAll = summaries.length
            const medAll = summaries.filter(s => s.riskLevel === "medium").length
            const highAll = summaries.filter(s => s.riskLevel === "high").length
            const critAll = summaries.filter(s => s.riskLevel === "critical").length
            const riskAll = medAll + highAll + critAll
            const rateAll = totalAll > 0 ? Math.round((riskAll / totalAll) * 1000) / 10 : 0

            if (rows.length === 0) return null

            return (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700">
                    센터/서비스/채널별 유의상담사 현황
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      전체 {totalAll}명 중 {riskAll}명 ({rateAll}%) — 주의 {medAll} / 위험 {highAll} / 심각 {critAll}
                    </span>
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">센터</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">서비스</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">채널</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">전체</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-amber-500">주의</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-orange-500">위험</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-red-500">심각</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">비율</th>
                        <th className="px-3 py-2 text-xs font-medium text-gray-500 w-[100px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r, i) => (
                        <tr key={i} className={r.critical > 0 ? "bg-red-50/50" : r.high > 0 ? "bg-orange-50/50" : ""}>
                          <td className="px-3 py-1.5 text-xs font-medium">{r.center}</td>
                          <td className="px-3 py-1.5 text-xs">{r.service}</td>
                          <td className="px-3 py-1.5 text-xs">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                              r.channel === "채팅" ? "bg-blue-50 text-blue-700" : r.channel === "유선" ? "bg-purple-50 text-purple-700" : ""
                            }`}>{r.channel}</span>
                          </td>
                          <td className="px-3 py-1.5 text-xs text-right tabular-nums">{r.total}명</td>
                          <td className="px-3 py-1.5 text-xs text-right tabular-nums font-medium">
                            {r.medium > 0 ? <span className="text-amber-600">{r.medium}</span> : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-3 py-1.5 text-xs text-right tabular-nums font-medium">
                            {r.high > 0 ? <span className="text-orange-600">{r.high}</span> : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-3 py-1.5 text-xs text-right tabular-nums font-medium">
                            {r.critical > 0 ? <span className="text-red-600 font-bold">{r.critical}</span> : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-3 py-1.5 text-xs text-right tabular-nums font-medium">
                            <span className={r.rate >= 30 ? "text-red-600" : r.rate >= 15 ? "text-amber-600" : ""}>{r.rate}%</span>
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${r.critical > 0 ? "bg-red-400" : r.high > 0 ? "bg-orange-400" : "bg-amber-400"}`}
                                style={{ width: `${Math.min(r.rate, 100)}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          {/* 리스크 테이블 */}
          <RiskHeatmapTable
            summaries={summaries}
            onAgentClick={handleAgentClick}
          />

          {/* 교차분석 인사이트 */}
          {crossAnalysis && (
            <CrossDomainInsights
              crossAnalysis={crossAnalysis}
              stats={stats}
              summaries={summaries}
              onAgentClick={handleAgentClick}
            />
          )}
        </>
      )}

      {/* 상담사 프로파일 모달 */}
      {selectedAgentId && (
        <AgentProfileModal
          profile={profile}
          loading={profileLoading}
          error={profileError}
          onClose={handleCloseModal}
          onNavigateToCoaching={onNavigateToCoaching}
        />
      )}
    </div>
  )
}
