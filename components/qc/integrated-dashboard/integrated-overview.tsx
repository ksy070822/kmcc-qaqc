"use client"

import { StatsCard } from "@/components/qc/stats-card"
import type { IntegratedDashboardStats } from "@/lib/types"
import { RISK_LEVEL_CONFIG } from "@/lib/constants"

interface IntegratedOverviewProps {
  stats: IntegratedDashboardStats
}

export function IntegratedOverview({ stats }: IntegratedOverviewProps) {
  const riskVariant = stats.avgRiskScore >= 50 ? "destructive"
    : stats.avgRiskScore >= 30 ? "warning" : "success"

  const highRiskCount = stats.riskDistribution.high + stats.riskDistribution.critical

  return (
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
  )
}
