"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MultiDomainTarget } from "@/lib/types"

interface SLAGoalPanelProps {
  year: number
  targets: MultiDomainTarget[]
  onChange: (targets: MultiDomainTarget[]) => void
}

interface SLAGradeRow {
  grade: string
  rangeLabel: string
  minScore: number
  maxScore: number
  rate: string
  badgeColor: string
}

const GRADE_TABLE: SLAGradeRow[] = [
  { grade: "S", rangeLabel: "100 ~ 97", minScore: 97, maxScore: 100, rate: "103%", badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { grade: "A", rangeLabel: "96 ~ 93", minScore: 93, maxScore: 96, rate: "102%", badgeColor: "bg-blue-100 text-blue-800 border-blue-300" },
  { grade: "B", rangeLabel: "92 ~ 89", minScore: 89, maxScore: 92, rate: "101%", badgeColor: "bg-sky-100 text-sky-800 border-sky-300" },
  { grade: "C", rangeLabel: "88 ~ 85", minScore: 85, maxScore: 88, rate: "100%", badgeColor: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { grade: "D", rangeLabel: "84 ~ 81", minScore: 81, maxScore: 84, rate: "99%", badgeColor: "bg-orange-100 text-orange-800 border-orange-300" },
  { grade: "E", rangeLabel: "80 이하", minScore: 0, maxScore: 80, rate: "97%", badgeColor: "bg-red-100 text-red-800 border-red-300" },
]

export function SLAGoalPanel({ year }: SLAGoalPanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">SLA 등급 기준</CardTitle>
            <CardDescription>
              {year}년 SLA 등급 기준표입니다. 생산성(60점) + 품질(40점) = 100점 만점 기준으로 산정됩니다.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">읽기 전용</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">등급</TableHead>
              <TableHead>점수 범위</TableHead>
              <TableHead>요율</TableHead>
              <TableHead>설명</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {GRADE_TABLE.map((row) => (
              <TableRow key={row.grade}>
                <TableCell>
                  <Badge variant="outline" className={`font-bold text-sm ${row.badgeColor}`}>
                    {row.grade}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">{row.rangeLabel}</TableCell>
                <TableCell className="font-mono text-sm font-medium">{row.rate}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {row.grade === "S" && "최우수 운영 (인센티브 +3%)"}
                  {row.grade === "A" && "우수 운영 (인센티브 +2%)"}
                  {row.grade === "B" && "양호 운영 (인센티브 +1%)"}
                  {row.grade === "C" && "기준 충족 (기본)"}
                  {row.grade === "D" && "기준 미달 (페널티 -1%)"}
                  {row.grade === "E" && "심각 미달 (페널티 -3%)"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs text-muted-foreground">
            <strong>SLA 산정 기준:</strong> 생산성 60점 (응대율, CPH 등) + 품질 40점 (QC 오류율, QA 점수, 상담평점) + 가감점
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            <strong>평가 제외:</strong> 근속 0개월차 상담사는 SLA 평가에서 제외됩니다.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
