"use client"

import { useState } from "react"
import { StatsCard } from "@/components/qc/stats-card"
import type { IntegratedDashboardStats } from "@/lib/types"
import { RISK_LEVEL_CONFIG } from "@/lib/constants"

interface IntegratedOverviewProps {
  stats: IntegratedDashboardStats
}

export function IntegratedOverview({ stats }: IntegratedOverviewProps) {
  const [showGuide, setShowGuide] = useState(false)
  const riskVariant = stats.avgRiskScore >= 50 ? "destructive"
    : stats.avgRiskScore >= 30 ? "warning" : "success"

  const highRiskCount = stats.riskDistribution.high + stats.riskDistribution.critical

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard
          title="평균 리스크 점수"
          value={`${stats.avgRiskScore.toFixed(1)}점`}
          subtitle="4대 항목 종합 (낮을수록 양호)"
          variant={riskVariant}
          centerBreakdown={
            stats.centerComparison.length >= 2
              ? {
                  yongsan: `${(stats.centerComparison.find(c => c.center === "용산")?.avgRisk || 0).toFixed(1)}`,
                  gwangju: `${(stats.centerComparison.find(c => c.center === "광주")?.avgRisk || 0).toFixed(1)}`,
                }
              : undefined
          }
        />

        <StatsCard
          title="분석 대상 인원"
          value={`${stats.agentsWithData}명`}
          subtitle={`전체 ${stats.totalAgents}명 중 1개 이상 항목 데이터 보유`}
          centerBreakdown={
            stats.centerComparison.length >= 2
              ? {
                  yongsan: `${stats.centerComparison.find(c => c.center === "용산")?.agents || 0}명`,
                  gwangju: `${stats.centerComparison.find(c => c.center === "광주")?.agents || 0}명`,
                }
              : undefined
          }
        />

        <StatsCard
          title="위험+심각 상담사"
          value={`${highRiskCount}명`}
          subtitle={`양호 ${stats.riskDistribution.low} / 주의 ${stats.riskDistribution.medium} / 위험 ${stats.riskDistribution.high} / 심각 ${stats.riskDistribution.critical}`}
          variant={highRiskCount > 0 ? "destructive" : "success"}
        />

        <div className="border border-border bg-card rounded-xl shadow-sm p-4 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">항목별 평균</p>
          <div className="space-y-1.5">
            {[
              { label: "QA (SLA)", value: stats.domainAverages.qa > 0 ? `${stats.domainAverages.qa.toFixed(1)}점` : "-" },
              { label: "QC 오류율", value: stats.domainAverages.qcRate > 0 ? `${stats.domainAverages.qcRate.toFixed(2)}%` : "-" },
              { label: "상담평점", value: stats.domainAverages.csat > 0 ? `${stats.domainAverages.csat.toFixed(2)}점` : "-" },
              { label: "직무테스트", value: stats.domainAverages.quiz > 0 ? `${stats.domainAverages.quiz.toFixed(1)}점` : "-" },
            ].map(d => (
              <div key={d.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{d.label}</span>
                <span className="font-medium">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 리스크 점수 안내 (접이식) */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowGuide(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-sm text-gray-600 cursor-pointer"
        >
          <span className="font-medium">리스크 점수 안내</span>
          <span className="text-xs">{showGuide ? "▲ 접기" : "▼ 펼치기"}</span>
        </button>
        {showGuide && (
          <div className="px-4 py-3 bg-white text-xs text-gray-600 space-y-3">
            <div>
              <p className="font-semibold text-gray-700 mb-1">점수 체계</p>
              <p>0~100점 (낮을수록 양호). QA(SLA핵심), QC오류율, 상담평점, 직무테스트 4대 항목을 가중 합산합니다.</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">등급 기준</p>
              <div className="flex gap-2 flex-wrap">
                {([
                  { label: "양호", range: "0~29점", color: RISK_LEVEL_CONFIG.low.color },
                  { label: "주의", range: "30~49점", color: RISK_LEVEL_CONFIG.medium.color },
                  { label: "위험", range: "50~69점", color: RISK_LEVEL_CONFIG.high.color },
                  { label: "심각", range: "70점이상", color: RISK_LEVEL_CONFIG.critical.color },
                ]).map(g => (
                  <span
                    key={g.label}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border"
                    style={{ borderColor: `${g.color}40`, backgroundColor: `${g.color}10`, color: g.color }}
                  >
                    <span className="font-semibold">{g.label}</span>
                    <span className="text-[10px]">{g.range}</span>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">채널별 가중치</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-50/50 rounded px-2 py-1.5">
                  <p className="font-medium text-blue-700">채팅</p>
                  <p>QA 35% + QC 25% + 평점 20% + 직무 20%</p>
                </div>
                <div className="bg-purple-50/50 rounded px-2 py-1.5">
                  <p className="font-medium text-purple-700">유선</p>
                  <p>QA 45% + QC 35% + 직무 20% (평점 해당없음)</p>
                </div>
              </div>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">데이터 커버리지 보정</p>
              <p>평가 항목이 적으면 리스크 점수 상한이 제한됩니다:</p>
              <p className="mt-1">1개 항목 = 최대 50점 | 2개 = 70점 | 3개 = 90점 | 4개 = 100점</p>
              <p className="text-gray-400 mt-1">예: 유선 신입(QC만 있음) → QC 오류율이 높아도 최대 50점(주의)까지만 판정</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
