"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { MypageBackButton } from "@/components/mypage/mypage-back-button"
import { MypageKpiCard } from "@/components/mypage/mypage-kpi-card"
import { useMypageQuizDetail } from "@/hooks/use-mypage-quiz-detail"
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts"
import { Loader2, TrendingUp, Lightbulb, AlertTriangle, Users } from "lucide-react"

interface MypageQuizDetailProps {
  agentId: string | null
  onBack: () => void
}

export function MypageQuizDetail({ agentId, onBack }: MypageQuizDetailProps) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const { data, loading } = useMypageQuizDetail(agentId, month)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">직무테스트 데이터를 불러오는 중...</span>
      </div>
    )
  }

  const avgScore = data?.avgScore ?? 0
  const pctile = data?.groupPercentile ?? 0
  const prevDiff = Math.round((avgScore - (data?.prevMonthScore ?? 0)) * 10) / 10
  const centerDiff = Math.round((avgScore - (data?.centerAvg ?? 0)) * 10) / 10

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <MypageBackButton onClick={onBack} />
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <h2 className="text-lg font-bold text-slate-900">업무지식 테스트 상세</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MypageKpiCard label="당월 응시횟수" value={String(data?.attemptCount ?? 0)} suffix="회" bgColor="bg-amber-50" />

        {/* Wrong answer count card */}
        <div className="rounded-xl p-4 border border-slate-200 bg-orange-50">
          <p className="text-xs text-slate-500 mb-2">오답 문항 수</p>
          <p className="text-2xl font-bold text-orange-900 tabular-nums">
            {data?.wrongAnswerCount ?? 0}<span className="text-sm font-normal ml-0.5 text-orange-400">문항</span>
          </p>
          {data?.topWrongCategory && (
            <div className="mt-2 pt-2 border-t border-orange-100">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-500 flex items-center gap-1">
                  <AlertTriangle className="h-2.5 w-2.5" /> 최다오답
                </span>
                <span className="font-bold text-rose-600">{data.topWrongCategory}</span>
              </div>
            </div>
          )}
        </div>

        <MypageKpiCard
          label="그룹 내 위치"
          value={`상위 ${pctile.toFixed(0)}`}
          suffix="%"
          bgColor="bg-yellow-50"
          badge={pctile <= 20 ? "우수" : pctile <= 50 ? "양호" : "노력"}
          badgeColor={pctile <= 20 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : pctile <= 50 ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200"}
        />

        {/* Score card with comparisons */}
        <div className="rounded-xl p-4 border border-slate-200 bg-slate-800">
          <p className="text-xs text-white/60 mb-2">평균 테스트 점수</p>
          <p className="text-2xl font-bold text-white tabular-nums">{avgScore.toFixed(1)}<span className="text-sm font-normal ml-0.5 text-white/50">점</span></p>
          <div className="mt-2 pt-2 border-t border-white/20 space-y-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">전월대비</span>
              <span className={cn("font-bold", prevDiff >= 0 ? "text-emerald-400" : "text-rose-400")}>
                {prevDiff > 0 ? "▲" : prevDiff < 0 ? "▼" : ""} {prevDiff !== 0 ? `${Math.abs(prevDiff)}점` : "-"}
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">전체평균대비</span>
              <span className={cn("font-bold", centerDiff >= 0 ? "text-emerald-400" : "text-rose-400")}>
                {centerDiff > 0 ? "▲" : centerDiff < 0 ? "▼" : ""} {centerDiff !== 0 ? `${Math.abs(centerDiff)}점` : "-"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Score Trend */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-amber-500" />
          업무지식 테스트 성취도 추이
        </p>
        {(data?.monthlyTrend ?? []).length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data?.monthlyTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#666666" }}
                axisLine={{ stroke: "#D9D9D9" }}
                tickFormatter={(v: string) => {
                  const parts = v.split("-")
                  return `${parts[0].slice(2)}.${parts[1]}`
                }}
              />
              <YAxis domain={[50, 100]} tick={{ fontSize: 10, fill: "#666666" }} axisLine={{ stroke: "#D9D9D9" }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #D9D9D9", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                labelStyle={{ color: "#000000", fontWeight: 600 }}
                formatter={(v: number, name: string) => [`${v}점`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: "10px" }} iconSize={8} />
              <ReferenceLine y={90} stroke="#DD2222" strokeDasharray="6 3" strokeOpacity={0.5} label={{ value: "합격 90", fontSize: 10, fill: "#DD2222" }} />
              <Bar dataKey="agentScore" name="본인 점수" fill="#f59e0b" barSize={28} radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="centerAvg" name="센터 평균" stroke="#9E9E9E" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: "#9E9E9E" }} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-40 text-sm text-slate-400">추이 데이터가 없습니다</div>
        )}
      </div>

      {/* Knowledge Radar + Coaching */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-medium text-slate-700 mb-3">지식 밸런스</p>
          {(data?.knowledgeRadar ?? data?.radarData ?? []).length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={data?.knowledgeRadar ?? data?.radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} />
                <Radar dataKey="value" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-sm text-slate-400">지식 밸런스 데이터 없음</div>
          )}
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-medium text-slate-700 mb-4">테스트 결과 맞춤 코칭</p>
          {(data?.coachingGuide ?? []).length > 0 ? (
            <div className="space-y-3">
              {data!.coachingGuide!.map((guide, i) => (
                <div key={i} className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                  <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-amber-600 uppercase">
                    <Lightbulb className="h-3.5 w-3.5" /> {guide.type}
                  </div>
                  <div className="text-sm font-bold text-slate-800 mb-1">{guide.title}</div>
                  <p className="text-[11px] text-slate-600 leading-relaxed italic">&quot;{guide.description}&quot;</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {avgScore < 90 && (
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                  <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-amber-600 uppercase">
                    <Lightbulb className="h-3.5 w-3.5" /> Focus
                  </div>
                  <div className="text-sm font-bold text-slate-800 mb-1">합격 기준 도달 필요</div>
                  <p className="text-[11px] text-slate-600 leading-relaxed italic">
                    &quot;현재 {avgScore.toFixed(1)}점으로 합격 기준(90점)에 {(90 - avgScore).toFixed(1)}점 부족합니다. 오답 항목 중심으로 학습이 필요합니다.&quot;
                  </p>
                </div>
              )}
              {avgScore >= 90 && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-emerald-600 uppercase">
                    <Lightbulb className="h-3.5 w-3.5" /> Excellent
                  </div>
                  <div className="text-sm font-bold text-slate-800 mb-1">우수한 업무지식 수준</div>
                  <p className="text-[11px] text-slate-600 leading-relaxed italic">
                    &quot;{avgScore.toFixed(1)}점으로 합격 기준을 충족했습니다. 지속적인 학습으로 현 수준을 유지해 주세요.&quot;
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="p-3 border rounded-lg bg-slate-50">
                  <div className="text-[10px] font-bold text-slate-400 mb-1 uppercase">Recommended</div>
                  <div className="text-xs font-bold text-slate-700">{avgScore < 90 ? "오답 항목 재학습" : "심화 가이드 교육"}</div>
                </div>
                <div className="p-3 border rounded-lg bg-slate-50">
                  <div className="text-[10px] font-bold text-slate-400 mb-1 uppercase">Next Goal</div>
                  <div className="text-xs font-bold text-slate-700">{avgScore < 90 ? "합격선(90점) 달성" : "상위 10% 진입"}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Wrong Answer Detail Table */}
      {(data?.wrongAnswers ?? []).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <p className="text-sm font-medium text-slate-700">나의 오답 문항 상세 분석</p>
            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded">오답 {data!.wrongAnswers!.length}건 집중 분석</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-5 text-xs font-medium text-slate-400 uppercase tracking-wider">문항</th>
                  <th className="text-left py-3 px-5 text-xs font-medium text-slate-400 uppercase tracking-wider w-2/5">문제 내용 요약</th>
                  <th className="text-center py-3 px-5 text-xs font-medium text-slate-400 uppercase tracking-wider">나의 선택</th>
                  <th className="text-center py-3 px-5 text-xs font-medium text-slate-400 uppercase tracking-wider">정답</th>
                  <th className="text-center py-3 px-5 text-xs font-medium text-slate-400 uppercase tracking-wider">전체 오답률</th>
                </tr>
              </thead>
              <tbody>
                {data!.wrongAnswers!.map((wa, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-5 text-slate-400 font-mono text-xs">{wa.questionNo}</td>
                    <td className="py-3 px-5 text-slate-800 font-bold text-xs">{wa.summary}</td>
                    <td className="py-3 px-5 text-center text-rose-500 text-xs">{wa.myAnswer}</td>
                    <td className="py-3 px-5 text-center text-emerald-600 text-xs">{wa.correctAnswer}</td>
                    <td className="py-3 px-5 text-center">
                      <span className={cn("font-bold text-xs", wa.centerWrongRate > 30 ? "text-rose-500" : "text-slate-400")}>
                        {wa.centerWrongRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Center Top 5 Wrong Answers */}
      {(data?.centerTopWrong ?? []).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-400" />
            센터 전체 빈출 오답 항목 (TOP 5)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {data!.centerTopWrong!.map((item) => (
              <div key={item.rank} className="p-3 border rounded-xl hover:shadow-md transition-shadow bg-slate-50/30">
                <div className="text-[10px] font-bold text-slate-400 mb-2">Rank {item.rank}</div>
                <div className="text-xs font-bold text-slate-800 mb-3 h-8 leading-tight">{item.topic}</div>
                <div className="flex justify-between items-end">
                  <span className="text-lg font-bold text-slate-700">{item.wrongRate}%</span>
                  <span className={cn(
                    "text-[10px] font-bold",
                    item.trend === "up" ? "text-rose-500" : item.trend === "down" ? "text-emerald-500" : "text-slate-400"
                  )}>
                    {item.trend === "up" ? "▲" : item.trend === "down" ? "▼" : "-"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test History Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <p className="text-sm font-medium text-slate-700">응시 내역</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-5 text-xs font-medium text-slate-400 uppercase tracking-wider">응시월</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-slate-400 uppercase tracking-wider">서비스</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-slate-400 uppercase tracking-wider">점수</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-slate-400 uppercase tracking-wider">합격 여부</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-slate-400 uppercase tracking-wider">센터 평균</th>
              </tr>
            </thead>
            <tbody>
              {(data?.attempts ?? []).length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400">응시 내역이 없습니다</td></tr>
              ) : (
                data!.attempts.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-5 text-slate-700">{row.date}</td>
                    <td className="py-3 px-5 text-slate-700">{row.service || "-"}</td>
                    <td className="py-3 px-5 text-slate-900 font-bold tabular-nums">{row.score}점</td>
                    <td className="py-3 px-5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-bold tracking-wider",
                          row.passed
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        )}
                      >
                        {row.passed ? "합격" : "불합격"}
                      </Badge>
                    </td>
                    <td className="py-3 px-5 text-slate-500 tabular-nums">{row.centerAvg}점</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
