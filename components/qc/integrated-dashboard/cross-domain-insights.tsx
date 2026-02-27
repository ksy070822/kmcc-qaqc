"use client"

import { useMemo } from "react"
import type { CrossAnalysisResult, IntegratedDashboardStats, AgentMonthlySummary } from "@/lib/types"
import { RISK_LEVEL_CONFIG, DOMAIN_LABELS } from "@/lib/constants"

interface CrossDomainInsightsProps {
  crossAnalysis: CrossAnalysisResult
  stats: IntegratedDashboardStats
  summaries: AgentMonthlySummary[]
  onAgentClick: (agentId: string) => void
}

// 부진 판정 기준
const WEAK_THRESHOLDS = {
  qa: (s: AgentMonthlySummary) => s.qaScore != null && s.qaScore < 75,
  qc: (s: AgentMonthlySummary) => s.qcEvalCount != null && s.qcEvalCount > 0 && s.qcTotalRate != null && s.qcTotalRate > 5,
  csat: (s: AgentMonthlySummary) => s.csatReviewCount != null && s.csatReviewCount > 0 && s.csatAvgScore != null && s.csatAvgScore < 3.5,
  quiz: (s: AgentMonthlySummary) => s.knowledgeScore != null && s.knowledgeScore < 60,
}

const DOMAIN_KEYS = ["qa", "qc", "csat", "quiz"] as const

export function CrossDomainInsights({ crossAnalysis, stats, summaries, onAgentClick }: CrossDomainInsightsProps) {
  // 다중 부진 패턴 분석
  const multiWeakAnalysis = useMemo(() => {
    // 각 상담사별 부진 도메인 추출
    const agentWeakDomains: Array<{ s: AgentMonthlySummary; domains: string[] }> = []
    for (const s of summaries) {
      const domains: string[] = []
      for (const key of DOMAIN_KEYS) {
        if (WEAK_THRESHOLDS[key](s)) domains.push(key)
      }
      if (domains.length > 0) agentWeakDomains.push({ s, domains })
    }

    // 항목별 부진 인원수
    const domainCounts: Record<string, number> = { qa: 0, qc: 0, csat: 0, quiz: 0 }
    for (const { domains } of agentWeakDomains) {
      for (const d of domains) domainCounts[d]++
    }

    // 2개 이상 동시 부진
    const multiWeak = agentWeakDomains.filter(a => a.domains.length >= 2)
    // 조합별 카운트
    const comboCounts = new Map<string, { label: string; count: number; agents: AgentMonthlySummary[] }>()
    for (const { s, domains } of multiWeak) {
      // 2개 조합
      for (let i = 0; i < domains.length; i++) {
        for (let j = i + 1; j < domains.length; j++) {
          const key = `${domains[i]}+${domains[j]}`
          const label = `${DOMAIN_LABELS[domains[i]] || domains[i]} + ${DOMAIN_LABELS[domains[j]] || domains[j]}`
          const entry = comboCounts.get(key) || { label, count: 0, agents: [] }
          entry.count++
          entry.agents.push(s)
          comboCounts.set(key, entry)
        }
      }
    }

    return {
      domainCounts,
      totalWeak: agentWeakDomains.length,
      multiWeak,
      combos: Array.from(comboCounts.values()).sort((a, b) => b.count - a.count),
    }
  }, [summaries])

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold text-gray-900">교차분석 인사이트</h3>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 리스크 분포 */}
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">리스크 등급 분포</h4>
          {(["low", "medium", "high", "critical"] as const).map(level => {
            const config = RISK_LEVEL_CONFIG[level]
            const count = crossAnalysis.riskDistribution[level] || 0
            const total = Object.values(crossAnalysis.riskDistribution).reduce((a, b) => a + b, 0)
            const pct = total > 0 ? (count / total) * 100 : 0

            return (
              <div key={level} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span style={{ color: config.color }} className="font-medium">{config.label}</span>
                  <span className="text-gray-600">{count}명 ({pct.toFixed(0)}%)</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: config.color }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* 다중 부진 패턴 */}
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">다중 부진 패턴</h4>
          <p className="text-xs text-gray-400">2개 이상 항목 동시 부진 상담사 (QA&lt;75, QC&gt;5%, 평점&lt;3.5, 직무&lt;60)</p>

          {/* 항목별 부진 인원 */}
          <div className="flex gap-1.5 flex-wrap">
            {DOMAIN_KEYS.map(key => {
              const count = multiWeakAnalysis.domainCounts[key]
              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    count > 0 ? "bg-red-50 text-red-700 border border-red-200" : "bg-gray-50 text-gray-400 border border-gray-200"
                  }`}
                >
                  {DOMAIN_LABELS[key]} {count}명
                </span>
              )
            })}
          </div>

          {/* 동시 부진 조합 */}
          {multiWeakAnalysis.combos.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-600">동시 부진 조합 ({multiWeakAnalysis.multiWeak.length}명)</p>
              {multiWeakAnalysis.combos.slice(0, 5).map(combo => (
                <div key={combo.label} className="flex items-center justify-between text-xs bg-orange-50/50 rounded-lg px-2.5 py-1.5">
                  <span className="text-gray-700 font-medium">{combo.label}</span>
                  <span className="text-orange-600 font-bold">{combo.count}명</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-2">2개 이상 동시 부진 없음</p>
          )}
        </div>

        {/* 단일 항목 부진 패턴 */}
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">단일 항목 부진 상담사</h4>
          <p className="text-xs text-gray-400">한 항목만 약점이고 나머지 정상/강점</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {crossAnalysis.weakInOnlyOne.length === 0 && (
              <p className="text-xs text-gray-400">해당 패턴 없음</p>
            )}
            {crossAnalysis.weakInOnlyOne.slice(0, 15).map(agent => (
              <div
                key={agent.summaryId}
                onClick={() => onAgentClick(agent.agentId)}
                className="flex items-center justify-between text-sm px-2 py-1.5 rounded-lg hover:bg-blue-50 cursor-pointer"
              >
                <div>
                  <span className="font-medium text-gray-800">{agent.agentId} / {agent.agentName || agent.agentId}</span>
                  <span className="text-xs text-gray-400 ml-1">{agent.center}</span>
                </div>
                <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">
                  {DOMAIN_LABELS[agent.weakDomain] || agent.weakDomain} 부진
                </span>
              </div>
            ))}
            {crossAnalysis.weakInOnlyOne.length > 15 && (
              <p className="text-xs text-gray-400 text-center">외 {crossAnalysis.weakInOnlyOne.length - 15}명</p>
            )}
          </div>
        </div>
      </div>

      {/* 센터 비교 */}
      {stats.centerComparison.length >= 2 && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">센터별 항목 평균 비교</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500">센터</th>
                  <th className="py-2 px-3 text-center text-xs font-medium text-gray-500">인원</th>
                  <th className="py-2 px-3 text-center text-xs font-medium text-gray-500">리스크</th>
                  <th className="py-2 px-3 text-center text-xs font-medium text-gray-500">QA (SLA)</th>
                  <th className="py-2 px-3 text-center text-xs font-medium text-gray-500">QC 오류율</th>
                  <th className="py-2 px-3 text-center text-xs font-medium text-gray-500">상담평점</th>
                  <th className="py-2 px-3 text-center text-xs font-medium text-gray-500">직무테스트</th>
                </tr>
              </thead>
              <tbody>
                {stats.centerComparison.map(c => (
                  <tr key={c.center} className="border-b border-gray-100">
                    <td className="py-2 px-3 font-medium">{c.center}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{c.agents}명</td>
                    <td className="py-2 px-3 text-center font-medium">{c.avgRisk.toFixed(1)}</td>
                    <td className="py-2 px-3 text-center">{c.qa > 0 ? c.qa.toFixed(1) : "-"}</td>
                    <td className="py-2 px-3 text-center">{c.qcRate > 0 ? `${c.qcRate.toFixed(2)}%` : "-"}</td>
                    <td className="py-2 px-3 text-center">{c.csat > 0 ? c.csat.toFixed(2) : "-"}</td>
                    <td className="py-2 px-3 text-center">{c.quiz > 0 ? c.quiz.toFixed(1) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
