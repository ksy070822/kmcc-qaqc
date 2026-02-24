"use client"

import type { CrossAnalysisResult, IntegratedDashboardStats, AgentMonthlySummary } from "@/lib/types"
import { RISK_LEVEL_CONFIG, DOMAIN_LABELS } from "@/lib/constants"

interface CrossDomainInsightsProps {
  crossAnalysis: CrossAnalysisResult
  stats: IntegratedDashboardStats
  onAgentClick: (agentId: string) => void
}

export function CrossDomainInsights({ crossAnalysis, stats, onAgentClick }: CrossDomainInsightsProps) {
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

        {/* 항목 간 상관관계 */}
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">항목 간 상관관계</h4>
          <p className="text-xs text-gray-400">공통 데이터 5건 이상, Pearson r</p>
          <div className="space-y-2">
            {crossAnalysis.correlations
              .filter(c => c.sampleSize >= 5)
              .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
              .map(c => {
                const strength = Math.abs(c.correlation)
                const direction = c.correlation > 0 ? "정상관" : "역상관"
                const label = strength >= 0.5 ? "강한" : strength >= 0.3 ? "보통" : "약한"
                const barColor = c.correlation > 0 ? "#3b82f6" : "#ef4444"

                return (
                  <div key={`${c.domainA}-${c.domainB}`} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">
                        {DOMAIN_LABELS[c.domainA] || c.domainA} ↔ {DOMAIN_LABELS[c.domainB] || c.domainB}
                      </span>
                      <span className="font-medium" style={{ color: barColor }}>
                        {c.correlation.toFixed(2)} ({label} {direction})
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.abs(c.correlation) * 100}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-8 text-right">n={c.sampleSize}</span>
                    </div>
                  </div>
                )
              })}
            {crossAnalysis.correlations.filter(c => c.sampleSize >= 5).length === 0 && (
              <p className="text-xs text-gray-400">충분한 데이터가 없습니다</p>
            )}
          </div>
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
                  <span className="font-medium text-gray-800">{agent.agentName || agent.agentId}</span>
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
