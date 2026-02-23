"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { QACenterStats } from "@/lib/types"
import { getQAScoreGrade } from "@/lib/constants"
import { ArrowUp, ArrowDown, Minus } from "lucide-react"

// 채널별 목표
const CHANNEL_TARGET: Record<string, number> = { "유선": 88, "채팅": 90 }

interface Props {
  centers: QACenterStats[]
  selectedCenter: string
}

// ─── A안: 카드 + shadcn 테이블 (유선/채팅 뱃지 구분) ───
function VersionA({ filtered, allCenterAvg }: { filtered: QACenterStats[]; allCenterAvg: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {filtered.map(center => {
        const diff = center.avgScore - allCenterAvg
        const voiceServices = center.services.filter(s => s.channel === "유선")
        const chatServices = center.services.filter(s => s.channel === "채팅")

        return (
          <div key={center.center} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">
                {center.center} (평균 {center.avgScore.toFixed(1)}점, {center.evaluations}건)
              </h3>
              {allCenterAvg > 0 && (
                <span className={`flex items-center gap-0.5 text-xs font-medium ${
                  diff > 0.5 ? "text-green-600" : diff < -0.5 ? "text-red-500" : "text-gray-500"
                }`}>
                  {diff > 0.5 ? <ArrowUp className="h-3 w-3" /> : diff < -0.5 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  양 센터 평균 대비 {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                </span>
              )}
            </div>

            {voiceServices.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">유선</Badge>
                  <span className="text-[10px] text-muted-foreground">목표 88점</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">서비스</TableHead>
                      <TableHead className="text-xs text-right">평균점수</TableHead>
                      <TableHead className="text-xs text-right">건수</TableHead>
                      <TableHead className="text-xs text-right">등급</TableHead>
                      <TableHead className="text-xs text-right">목표 대비</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {voiceServices.map(svc => {
                      const grade = getQAScoreGrade(svc.avgScore)
                      const targetDiff = svc.avgScore - 88
                      return (
                        <TableRow key={`${svc.name}-voice`}>
                          <TableCell className="text-xs">{svc.name}</TableCell>
                          <TableCell className="text-xs text-right font-medium">{svc.avgScore.toFixed(1)}</TableCell>
                          <TableCell className="text-xs text-right">{svc.evaluations}</TableCell>
                          <TableCell className="text-xs text-right">
                            <span style={{ color: grade.color }} className="font-medium">{grade.label}</span>
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            <span className={cn("font-medium", targetDiff >= 0 ? "text-green-600" : "text-red-500")}>
                              {targetDiff >= 0 ? "+" : ""}{targetDiff.toFixed(1)}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {chatServices.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">채팅</Badge>
                  <span className="text-[10px] text-muted-foreground">목표 90점</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">서비스</TableHead>
                      <TableHead className="text-xs text-right">평균점수</TableHead>
                      <TableHead className="text-xs text-right">건수</TableHead>
                      <TableHead className="text-xs text-right">등급</TableHead>
                      <TableHead className="text-xs text-right">목표 대비</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chatServices.map(svc => {
                      const grade = getQAScoreGrade(svc.avgScore)
                      const targetDiff = svc.avgScore - 90
                      return (
                        <TableRow key={`${svc.name}-chat`}>
                          <TableCell className="text-xs">{svc.name}</TableCell>
                          <TableCell className="text-xs text-right font-medium">{svc.avgScore.toFixed(1)}</TableCell>
                          <TableCell className="text-xs text-right">{svc.evaluations}</TableCell>
                          <TableCell className="text-xs text-right">
                            <span style={{ color: grade.color }} className="font-medium">{grade.label}</span>
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            <span className={cn("font-medium", targetDiff >= 0 ? "text-green-600" : "text-red-500")}>
                              {targetDiff >= 0 ? "+" : ""}{targetDiff.toFixed(1)}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── B안: QC 스타일 (서비스 rowSpan + 바 차트) ───

function groupByService(
  services: QACenterStats["services"],
): Array<{ service: string; rows: QACenterStats["services"] }> {
  const serviceMap = new Map<string, QACenterStats["services"]>()
  const order: string[] = []
  for (const svc of services) {
    if (!svc.name?.trim()) continue
    if (!serviceMap.has(svc.name)) {
      serviceMap.set(svc.name, [])
      order.push(svc.name)
    }
    serviceMap.get(svc.name)!.push(svc)
  }
  return order.map((service) => ({ service, rows: serviceMap.get(service)! }))
}

function VersionB({ filtered }: { filtered: QACenterStats[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {filtered.map((center) => {
        const rateColor =
          center.avgScore >= 92
            ? "bg-emerald-100 text-emerald-700"
            : center.avgScore >= 90
              ? "bg-blue-100 text-blue-700"
              : center.avgScore >= 88
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"

        const serviceGroups = groupByService(center.services)

        return (
          <div key={center.center} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">{center.center}</span>
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold", rateColor)}>
                  {center.avgScore.toFixed(1)}점
                </span>
              </div>
              <div className="text-xs text-gray-500">{center.evaluations}건 평가</div>
            </div>
            <div className="text-xs text-gray-500 mb-3">유선 목표: 88점 · 채팅 목표: 90점</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="text-left">서비스</th>
                  <th className="text-left">채널</th>
                  <th>건수</th>
                  <th>평균</th>
                  <th>등급</th>
                  <th>목표 대비</th>
                  <th className="w-[100px]"></th>
                </tr>
              </thead>
              <tbody>
                {serviceGroups.map((sg) =>
                  sg.rows.map((row, i) => {
                    const target = CHANNEL_TARGET[row.channel] || 88
                    const diff = row.avgScore - target
                    const rowGrade = getQAScoreGrade(row.avgScore)
                    const barColor =
                      row.avgScore >= target ? "bg-emerald-500"
                        : row.avgScore >= target - 2 ? "bg-amber-500"
                          : "bg-red-500"
                    const barW = Math.min(100, Math.max(0, ((row.avgScore - 80) / 20) * 100))
                    return (
                      <tr
                        key={`${row.name}-${row.channel}`}
                        className={i === 0 && sg.rows.length > 1 ? "border-t border-slate-200" : ""}
                      >
                        {i === 0 && (
                          <td className="text-left font-medium align-middle" rowSpan={sg.rows.length}>
                            {sg.service}
                          </td>
                        )}
                        <td className="text-left text-gray-600">{row.channel}</td>
                        <td>{row.evaluations}건</td>
                        <td className="font-medium">{row.avgScore.toFixed(1)}</td>
                        <td>
                          <span style={{ color: rowGrade.color }} className="font-medium text-[11px]">{rowGrade.label}</span>
                        </td>
                        <td>
                          <span className={cn("font-medium", diff >= 0 ? "text-emerald-600" : "text-red-500")}>
                            {diff >= 0 ? "+" : ""}{diff.toFixed(1)}
                          </span>
                        </td>
                        <td>
                          <div className="h-1.5 rounded-sm bg-slate-200 overflow-hidden">
                            <div className={cn("h-full rounded-sm transition-all", barColor)} style={{ width: `${barW}%` }} />
                          </div>
                        </td>
                      </tr>
                    )
                  }),
                )}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

// ─── 메인: A/B 토글 ───
export function QACenterComparison({ centers, selectedCenter }: Props) {
  const [version, setVersion] = useState<"A" | "B">("B")
  const filtered = selectedCenter === "all" ? centers : centers.filter(c => c.center === selectedCenter)

  const totalEvals = centers.reduce((sum, c) => sum + c.evaluations, 0)
  const allCenterAvg = totalEvals > 0
    ? centers.reduce((sum, c) => sum + c.avgScore * c.evaluations, 0) / totalEvals
    : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">센터별 QA 점수 비교</h3>
        <div className="flex gap-1">
          <Button size="sm" variant={version === "A" ? "default" : "outline"} className="h-7 text-xs" onClick={() => setVersion("A")}>
            A. 카드 + 뱃지
          </Button>
          <Button size="sm" variant={version === "B" ? "default" : "outline"} className="h-7 text-xs" onClick={() => setVersion("B")}>
            B. QC 스타일
          </Button>
        </div>
      </div>
      {version === "A"
        ? <VersionA filtered={filtered} allCenterAvg={allCenterAvg} />
        : <VersionB filtered={filtered} />
      }
    </div>
  )
}
