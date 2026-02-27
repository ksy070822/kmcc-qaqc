"use client"

import { useEffect, useState } from "react"
import { ResponsiveContainer, LineChart, Line, ReferenceLine, Tooltip } from "recharts"
import type {
  AgentCoachingPlan,
  ConsultTypeErrorAnalysis,
  ConsultTypeCorrectionAnalysis,
  CoachingTier,
  TrendAnalysis,
} from "@/lib/types"

const TIER_COLORS: Record<CoachingTier, string> = {
  "일반": "#22c55e", "주의": "#0ea5e9", "위험": "#eab308", "심각": "#f97316", "긴급": "#ef4444",
}

interface AgentCoachingCardProps {
  plan: AgentCoachingPlan
  month: string
  onClose: () => void
  onNavigateToIntegrated?: (agentId: string) => void
}

export function AgentCoachingCard({ plan, month, onClose, onNavigateToIntegrated }: AgentCoachingCardProps) {
  const [drilldown, setDrilldown] = useState<{
    errors: ConsultTypeErrorAnalysis[]
    corrections: ConsultTypeCorrectionAnalysis
  } | null>(null)
  const [trend, setTrend] = useState<{ trend: any[]; analysis: TrendAnalysis | null } | null>(null)
  const [loading, setLoading] = useState(false)

  // ESC 키로 닫기
  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handle)
    return () => window.removeEventListener("keydown", handle)
  }, [onClose])

  // 드릴다운 & 추세 로드
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [drillRes, trendRes] = await Promise.all([
          fetch(`/api/coaching?action=drilldown&agentId=${plan.agentId}&month=${month}`),
          fetch(`/api/coaching?action=trend&agentId=${plan.agentId}`),
        ])
        const drillJson = await drillRes.json()
        const trendJson = await trendRes.json()
        if (drillJson.success) setDrilldown(drillJson.data)
        if (trendJson.success) setTrend(trendJson.data)
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [plan.agentId, month])

  const trendLabel: Record<string, { text: string; color: string }> = {
    improving: { text: "개선 중", color: "text-green-600" },
    stable: { text: "안정", color: "text-gray-600" },
    deteriorating: { text: "악화 중", color: "text-red-600" },
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">{plan.agentName || plan.agentId}</h2>
            <p className="text-sm text-gray-500">
              {plan.center} / {plan.service} / {plan.channel} / 근속 {plan.tenureMonths}개월
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="px-3 py-1 rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: TIER_COLORS[plan.tier] }}
            >
              {plan.tier}
            </span>
            <span className="text-xl font-mono font-bold">{plan.riskScore.toFixed(1)}</span>
            {onNavigateToIntegrated && (
              <button
                onClick={() => { onClose(); onNavigateToIntegrated(plan.agentId); }}
                className="ml-2 px-2.5 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                통합 프로파일
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl ml-2">&times;</button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* 티어 판정 근거 */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            {plan.tierReason}
          </div>

          {/* 추세 스파크라인 */}
          {trend && trend.trend && trend.trend.length > 1 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">QC 추세 (최근 {trend.trend.length}주)</span>
                {trend.analysis && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className={trendLabel[trend.analysis.direction]?.color || ""}>
                      {trendLabel[trend.analysis.direction]?.text || trend.analysis.direction}
                    </span>
                    <span className="text-gray-400">
                      기울기 {trend.analysis.slope > 0 ? "+" : ""}{trend.analysis.slope.toFixed(3)}
                    </span>
                  </div>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg p-2" style={{ height: 72 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend.trend}>
                    <ReferenceLine y={5} stroke="#d1d5db" strokeDasharray="3 3" />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={
                        trend.analysis?.direction === "improving" ? "#22c55e"
                          : trend.analysis?.direction === "deteriorating" ? "#ef4444"
                          : "#6b7280"
                      }
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#fff", strokeWidth: 2 }}
                      activeDot={{ r: 4 }}
                    />
                    <Tooltip
                      formatter={(v: number) => [`${v.toFixed(1)}%`, "오류율"]}
                      labelFormatter={(i: number) => `${i + 1}주차`}
                      contentStyle={{ fontSize: 12, padding: "4px 8px" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 취약 카테고리 */}
          <div>
            <h3 className="text-sm font-bold mb-2">취약 카테고리</h3>
            <div className="space-y-2">
              {plan.weaknesses
                .filter(w => w.severity !== "normal")
                .sort((a, b) => a.score - b.score)
                .map(w => (
                  <div key={w.categoryId} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          w.severity === "critical" ? "bg-red-500" : "bg-orange-400"
                        }`} />
                        <span className="font-medium text-sm">{w.label}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          w.severity === "critical" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                        }`}>
                          {w.severity === "critical" ? "심각" : "취약"}
                        </span>
                      </div>
                      <span className="text-sm font-mono">{w.score.toFixed(0)}점</span>
                    </div>
                    {/* QC 근거 */}
                    {w.qcEvidence.errorCount > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        QC: {w.qcEvidence.errorItems.join(", ")} ({w.qcEvidence.errorCount}건/{w.qcEvidence.totalEvals}건, {(w.qcEvidence.errorRate * 100).toFixed(1)}%)
                      </div>
                    )}
                    {/* QA 근거 */}
                    {w.qaEvidence.items.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        QA: {w.qaEvidence.items.map(i => `${i.name} ${i.score}/${i.maxScore}`).join(", ")} (평균 {(w.qaEvidence.avgRate * 100).toFixed(0)}%)
                      </div>
                    )}
                  </div>
                ))}
              {plan.weaknesses.filter(w => w.severity !== "normal").length === 0 && (
                <div className="text-sm text-gray-400 text-center py-4">취약 카테고리 없음</div>
              )}
            </div>
          </div>

          {/* 코칭 처방 */}
          {plan.prescriptions.length > 0 && (
            <div>
              <h3 className="text-sm font-bold mb-2">코칭 처방</h3>
              <div className="space-y-2">
                {plan.prescriptions.map((p, i) => (
                  <div key={i} className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-blue-800">{p.categoryLabel}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        p.severity === "critical" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                      }`}>
                        {p.severity === "critical" ? "긴급" : "필요"}
                      </span>
                    </div>
                    <p className="text-sm text-blue-700">{p.description}</p>
                    {p.consultTypeDetail && (
                      <p className="text-xs text-blue-500 mt-1">상담유형: {p.consultTypeDetail}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">근거: {p.evidence}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 상담유형 드릴다운 (업무지식) */}
          {loading && (
            <div className="text-center py-4 text-gray-400 text-sm">드릴다운 로딩 중...</div>
          )}
          {drilldown && drilldown.errors.length > 0 && (
            <div>
              <h3 className="text-sm font-bold mb-2">업무지식 오류 - 상담유형별 분포</h3>
              <table className="w-full text-sm border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">2뎁스</th>
                    <th className="text-left px-3 py-2">3뎁스</th>
                    <th className="text-center px-3 py-2">오류 건</th>
                    <th className="text-center px-3 py-2">비율</th>
                    <th className="text-center px-3 py-2">그룹 평균</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {drilldown.errors.map((e, i) => (
                    <tr key={i} className={e.isHighlighted ? "bg-red-50" : ""}>
                      <td className="px-3 py-2">{e.depth2}</td>
                      <td className="px-3 py-2 text-gray-500">{e.depth3 || "-"}</td>
                      <td className="px-3 py-2 text-center font-mono">{e.errorCount}</td>
                      <td className="px-3 py-2 text-center font-mono">{e.errorPct}%</td>
                      <td className="px-3 py-2 text-center font-mono text-gray-400">{e.groupAvgErrorPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 상담유형 오설정 분석 */}
          {drilldown && drilldown.corrections.correctionCount > 0 && (
            <div>
              <h3 className="text-sm font-bold mb-2">
                상담유형 오설정 ({drilldown.corrections.correctionRate}%, {drilldown.corrections.correctionCount}/{drilldown.corrections.totalEvals}건)
              </h3>
              <div className="space-y-1">
                {drilldown.corrections.topMisclassifications.map((m, i) => (
                  <div key={i} className="text-xs text-gray-600 flex items-center gap-2">
                    <span className="bg-gray-100 px-2 py-0.5 rounded">{m.originalDepth1}/{m.originalDepth2}</span>
                    <span className="text-gray-400">&rarr;</span>
                    <span className="bg-yellow-100 px-2 py-0.5 rounded">{m.correctedDepth1}/{m.correctedDepth2}</span>
                    <span className="font-mono">({m.count}건)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
