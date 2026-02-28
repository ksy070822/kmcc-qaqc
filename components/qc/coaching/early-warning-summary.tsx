"use client"

import { useState, useMemo } from "react"
import type { AgentMonthlySummary } from "@/lib/types"
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react"

interface EarlyWarningSummaryProps {
  summaries: AgentMonthlySummary[]
  onAgentClick?: (agentId: string) => void
}

interface WarningAgent {
  agentId: string
  agentName: string
  center: string
  domains: string[]    // 하락 도메인 목록
  severity: "warning" | "critical"  // 2개=warning, 3개+=critical
}

/**
 * 다중 영역 동시 하락 에이전트를 감지하는 조기 경보 컴포넌트.
 *
 * 판정 기준:
 * - QC 오류율 > 5% (목표 초과)
 * - QA 점수 < 75 (하위 수준)
 * - 상담평점 < 3.5 (저점)
 * - 직무테스트 < 60 (미달)
 *
 * 2개 이상 동시 해당 → 위험 (warning)
 * 3개 이상 동시 해당 → 심각 (critical)
 */
function detectMultiDomainDecline(summaries: AgentMonthlySummary[]): WarningAgent[] {
  const warnings: WarningAgent[] = []

  for (const s of summaries) {
    const domains: string[] = []

    if (s.qcTotalRate != null && s.qcEvalCount && s.qcEvalCount > 0 && s.qcTotalRate > 5) {
      domains.push("QC")
    }
    if (s.qaScore != null && s.qaScore < 75) {
      domains.push("QA")
    }
    if (s.csatAvgScore != null && s.csatReviewCount && s.csatReviewCount > 0 && s.csatAvgScore < 3.5) {
      domains.push("상담평점")
    }
    if (s.knowledgeScore != null && s.knowledgeScore < 60) {
      domains.push("직무")
    }

    if (domains.length >= 2) {
      warnings.push({
        agentId: s.agentId,
        agentName: s.agentName || s.agentId,
        center: s.center,
        domains,
        severity: domains.length >= 3 ? "critical" : "warning",
      })
    }
  }

  return warnings.sort((a, b) => b.domains.length - a.domains.length)
}

export function EarlyWarningSummary({ summaries, onAgentClick }: EarlyWarningSummaryProps) {
  const [expanded, setExpanded] = useState(false)
  const warnings = useMemo(() => detectMultiDomainDecline(summaries), [summaries])

  const criticalCount = warnings.filter(w => w.severity === "critical").length
  const warningCount = warnings.filter(w => w.severity === "warning").length

  if (warnings.length === 0) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <span className="font-semibold text-amber-900">
            다중 영역 하락 감지 {warnings.length}명
          </span>
          {criticalCount > 0 && (
            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
              심각 {criticalCount}명
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
              위험 {warningCount}명
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-amber-600" /> : <ChevronDown className="h-4 w-4 text-amber-600" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-amber-700 mb-2">
            2개 이상 품질 영역에서 동시에 기준 미달인 상담사입니다. 복합적 코칭이 필요합니다.
          </p>
          <div className="grid gap-2">
            {warnings.map(w => (
              <div
                key={w.agentId}
                className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                  w.severity === "critical"
                    ? "bg-red-50 border border-red-200 hover:bg-red-100"
                    : "bg-white border border-amber-200 hover:bg-amber-50"
                }`}
                onClick={() => onAgentClick?.(w.agentId)}
              >
                <div>
                  <span className="font-medium text-sm">{w.agentName}</span>
                  <span className="text-xs text-gray-500 ml-2">{w.center}</span>
                </div>
                <div className="flex items-center gap-1">
                  {w.domains.map(d => (
                    <span
                      key={d}
                      className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        w.severity === "critical"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
