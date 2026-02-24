"use client"

import { useEffect } from "react"
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts"
import type { AgentIntegratedProfile } from "@/lib/types"
import { RISK_LEVEL_CONFIG, DOMAIN_LABELS, QC_RATE_CAP } from "@/lib/constants"

interface AgentProfileModalProps {
  profile: AgentIntegratedProfile | null
  loading: boolean
  error: string | null
  onClose: () => void
}

const LEVEL_BADGE: Record<string, { label: string; color: string }> = {
  strong: { label: "강점", color: "#22c55e" },
  normal: { label: "보통", color: "#3b82f6" },
  weak: { label: "약점", color: "#ef4444" },
  nodata: { label: "데이터 없음", color: "#9ca3af" },
}

export function AgentProfileModal({ profile, loading, error, onClose }: AgentProfileModalProps) {
  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  if (!profile && !loading && !error) return null

  // 레이더 차트 데이터: 0-100 정규화
  const radarData = profile ? [
    {
      domain: "QA (SLA)",
      value: profile.current.qaScore ?? 0,
      fullMark: 100,
    },
    {
      domain: "QC (반전)",
      value: profile.current.qcEvalCount && profile.current.qcEvalCount > 0 && profile.current.qcTotalRate != null
        ? Math.max(0, 100 - Math.min((profile.current.qcTotalRate / QC_RATE_CAP) * 100, 100))
        : 50, // 미검수 = 중간값
      fullMark: 100,
    },
    {
      domain: "상담평점",
      value: profile.current.csatAvgScore != null && profile.current.csatReviewCount && profile.current.csatReviewCount > 0
        ? ((profile.current.csatAvgScore - 1) / 4) * 100
        : 50,
      fullMark: 100,
    },
    {
      domain: "직무테스트",
      value: profile.current.knowledgeScore ?? 0,
      fullMark: 100,
    },
  ] : []

  // 추이 차트 데이터
  const trendData = profile?.monthlyTrend.map(m => ({
    month: m.month.slice(5), // "02" 형태
    QA: m.qaScore != null ? Number(m.qaScore.toFixed(2)) : null,
    QC오류율: m.qcRate != null ? Number(m.qcRate.toFixed(2)) : null,
    상담평점: m.csatScore != null ? Number((m.csatScore * 20).toFixed(2)) : null, // 5점→100 스케일
    _상담평점원본: m.csatScore != null ? Number(m.csatScore.toFixed(2)) : null, // 툴팁용 5점 스케일
    직무테스트: m.quizScore != null ? Number(m.quizScore.toFixed(2)) : null,
    리스크: m.riskScore != null ? Number(m.riskScore.toFixed(2)) : null,
  })) || []

  const riskLevel = profile?.current.riskLevel || "low"
  const riskConfig = RISK_LEVEL_CONFIG[riskLevel]

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            {profile && (
              <>
                <h2 className="text-lg font-bold text-gray-900">
                  {profile.agentName}
                  <span className="text-sm font-normal text-gray-500 ml-2">{profile.agentId}</span>
                </h2>
                <p className="text-sm text-gray-500">
                  {profile.center} {profile.service && `/ ${profile.service}`} {profile.channel && `/ ${profile.channel}`}
                </p>
              </>
            )}
            {loading && <h2 className="text-lg font-bold text-gray-400">로딩 중...</h2>}
            {error && <h2 className="text-lg font-bold text-red-500">오류 발생</h2>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {loading && (
          <div className="p-12 text-center text-gray-400">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
            프로파일 로딩 중...
          </div>
        )}

        {error && (
          <div className="p-8 text-center text-red-500 text-sm">{error}</div>
        )}

        {profile && (
          <div className="p-6 space-y-6">
            {/* 종합 리스크 + 강점/약점 배지 */}
            <div className="flex items-start gap-6">
              <div className="text-center">
                <div
                  className="text-3xl font-bold"
                  style={{ color: riskConfig.color }}
                >
                  {(profile.current.compositeRiskScore || 0).toFixed(2)}
                </div>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold mt-1"
                  style={{ backgroundColor: `${riskConfig.color}20`, color: riskConfig.color }}
                >
                  {riskConfig.label}
                </span>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-2">
                {profile.strengthWeakness.map(sw => {
                  const badge = LEVEL_BADGE[sw.level]
                  return (
                    <div
                      key={sw.domain}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100"
                    >
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold"
                        style={{ backgroundColor: `${badge.color}20`, color: badge.color }}
                      >
                        {badge.label}
                      </span>
                      <div className="text-sm">
                        <span className="font-medium">{DOMAIN_LABELS[sw.domain] || sw.domain}</span>
                        <span className="text-gray-400 ml-1 text-xs">{sw.note}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 레이더 차트 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">항목별 역량 (0-100 정규화)</h3>
              <p className="text-xs text-gray-400 mb-2">QC: 오류율 반전 (높을수록 좋음) | 상담평점: 미검수/미리뷰 = 중간값 표시</p>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                  <PolarGrid />
                  <PolarAngleAxis dataKey="domain" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar
                    name="역량"
                    dataKey="value"
                    stroke="#2c6edb"
                    fill="#2c6edb"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* 6개월 추이 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">최근 추이</h3>
              <p className="text-xs text-gray-400 mb-2">상담평점은 5점→100점 스케일 변환 표시</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 text-xs">
                        <p className="font-semibold mb-1">{label}월</p>
                        {payload.map((p: any) => {
                          if (p.dataKey === '상담평점' && p.payload._상담평점원본 != null) {
                            return <p key={p.dataKey} style={{ color: p.stroke }}>상담평점: {p.payload._상담평점원본}/5.0 ({p.value})</p>
                          }
                          return <p key={p.dataKey} style={{ color: p.stroke }}>{p.name}: {p.value}</p>
                        })}
                      </div>
                    )
                  }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="QA" stroke="#2c6edb" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line type="monotone" dataKey="직무테스트" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line type="monotone" dataKey="상담평점" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 3 }} strokeDasharray="4 2" connectNulls />
                  <Line type="monotone" dataKey="리스크" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 상세 수치 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">현재월 상세 수치</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">QA 점수 (SLA 핵심)</p>
                  <p className="text-lg font-bold">{profile.current.qaScore?.toFixed(1) ?? "-"}<span className="text-sm font-normal">/100</span></p>
                  <p className="text-xs text-gray-400">{profile.current.qaEvalCount ?? 0}건 평가</p>
                </div>
                <div className="bg-orange-50/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">QC 오류율 (일별 정기활동)</p>
                  <p className="text-lg font-bold">
                    {profile.current.qcEvalCount && profile.current.qcEvalCount > 0
                      ? `${(profile.current.qcTotalRate ?? 0).toFixed(2)}%`
                      : "-"}
                  </p>
                  <p className="text-xs text-gray-400">{profile.current.qcEvalCount ?? 0}건 검수</p>
                </div>
                <div className="bg-amber-50/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">상담평점</p>
                  <p className="text-lg font-bold">
                    {profile.current.csatAvgScore != null && profile.current.csatReviewCount
                      ? profile.current.csatAvgScore.toFixed(2) : "-"}
                    <span className="text-sm font-normal">/5.0</span>
                  </p>
                  <p className="text-xs text-gray-400">{profile.current.csatReviewCount ?? 0}건 리뷰 · 저점 ≠ 상담 미흡</p>
                </div>
                <div className="bg-purple-50/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">직무테스트 (SLA 합산)</p>
                  <p className="text-lg font-bold">{profile.current.knowledgeScore?.toFixed(0) ?? "-"}<span className="text-sm font-normal">/100</span></p>
                  <p className="text-xs text-gray-400">{profile.current.knowledgeTestCount ?? 0}회 응시 · 합격 80점</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
