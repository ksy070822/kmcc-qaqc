"use client"

import type { NewHireProfile } from "@/lib/types"
import { StatsCard } from "@/components/qc/stats-card"

interface NewHireDashboardProps {
  newHires: NewHireProfile[]
}

export function NewHireDashboard({ newHires }: NewHireDashboardProps) {
  const slowCount = newHires.filter(n => n.isSlowStabilization).length

  return (
    <div className="space-y-4">
      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3">
        <StatsCard
          title="신입 상담사"
          value={newHires.length}
          subtitle="2개월 미만"
          variant="default"
        />
        <StatsCard
          title="안정화 지연"
          value={slowCount}
          variant="warning"
        />
        <StatsCard
          title="정상 적응"
          value={newHires.length - slowCount}
          variant="success"
        />
      </div>

      {/* 신입 목록 */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">상담사</th>
              <th className="text-left px-3 py-3 font-medium text-gray-600">센터</th>
              <th className="text-left px-3 py-3 font-medium text-gray-600">채널</th>
              <th className="text-center px-3 py-3 font-medium text-gray-600">입사일</th>
              <th className="text-center px-3 py-3 font-medium text-gray-600">근속</th>
              <th className="text-center px-3 py-3 font-medium text-gray-600">QC 오류율</th>
              <th className="text-center px-3 py-3 font-medium text-gray-600" title="동일 입사 주차의 과거 신입 상담사 평균 오류율">동기 평균</th>
              <th className="text-center px-3 py-3 font-medium text-gray-600">상담평점</th>
              <th className="text-left px-3 py-3 font-medium text-gray-600">취약 카테고리</th>
              <th className="text-center px-3 py-3 font-medium text-gray-600">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {newHires
              .sort((a, b) => {
                // 지연 먼저, 그 다음 오류율 높은 순
                if (a.isSlowStabilization !== b.isSlowStabilization) return a.isSlowStabilization ? -1 : 1
                return b.weeklyQcErrorRate - a.weeklyQcErrorRate
              })
              .map(nh => (
                <tr key={nh.agentId} className={nh.isSlowStabilization ? "bg-red-50/50" : ""}>
                  <td className="px-4 py-3 font-medium">{nh.agentName || nh.agentId}</td>
                  <td className="px-3 py-3 text-gray-600">{nh.center}</td>
                  <td className="px-3 py-3 text-gray-600">{nh.channel}</td>
                  <td className="px-3 py-3 text-center text-gray-500 text-xs">{nh.hireDate}</td>
                  <td className="px-3 py-3 text-center">{nh.tenureDays}일</td>
                  <td className="px-3 py-3 text-center font-mono">
                    <span className={nh.weeklyQcErrorRate > 10 ? "text-red-600 font-bold" : ""}>
                      {nh.weeklyQcErrorRate}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-gray-400">
                    {nh.cohortAvgErrorRate.toFixed(1)}%
                  </td>
                  <td className="px-3 py-3 text-center font-mono">
                    {nh.csatAvg != null ? (
                      <span className={nh.csatAvg < 3.5 ? "text-red-600" : ""}>
                        {nh.csatAvg.toFixed(2)}
                        {nh.csatLowRate != null && nh.csatLowRate > 10 && (
                          <span className="text-red-400 text-xs ml-1">({nh.csatLowRate.toFixed(0)}%저)</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">{nh.channel === "유선" ? "해당없음" : "조회불가"}</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {nh.categoryErrors.slice(0, 3).map(c => (
                        <span key={c.categoryId} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                          {c.label}({c.count})
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {nh.isSlowStabilization ? (
                      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">지연</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">정상</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {newHires.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            현재 2개월 미만 신입 상담사가 없습니다
          </div>
        )}
      </div>

      {/* 일별 추이 (각 신입 미니 차트) */}
      {newHires.filter(n => n.dailyQcTrend.length > 0).length > 0 && (
        <div>
          <h3 className="text-sm font-bold mb-2">일별 QC 오류 추이</h3>
          <div className="grid grid-cols-2 gap-3">
            {newHires
              .filter(n => n.dailyQcTrend.length > 0)
              .slice(0, 6)
              .map(nh => (
                <div key={nh.agentId} className="border rounded-lg p-3">
                  <div className="text-sm font-medium mb-2">
                    {nh.agentName} ({nh.tenureDays}일차)
                    {nh.isSlowStabilization && (
                      <span className="ml-2 text-xs text-red-500">안정화 지연</span>
                    )}
                  </div>
                  <div className="flex items-end gap-0.5 h-12">
                    {nh.dailyQcTrend.map((d, i) => {
                      const maxRate = Math.max(...nh.dailyQcTrend.map(t => t.errorRate), 1)
                      const height = (d.errorRate / maxRate) * 100
                      return (
                        <div
                          key={i}
                          className={`flex-1 rounded-t ${
                            d.errorRate > 15 ? "bg-red-400" : d.errorRate > 5 ? "bg-orange-300" : "bg-green-300"
                          }`}
                          style={{ height: `${Math.max(height, 4)}%` }}
                          title={`${d.date}: ${d.errorRate}% (${d.evalCount}건)`}
                        />
                      )
                    })}
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>{nh.dailyQcTrend[0]?.date.slice(5)}</span>
                    <span>{nh.dailyQcTrend[nh.dailyQcTrend.length - 1]?.date.slice(5)}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
