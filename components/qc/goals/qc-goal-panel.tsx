"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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

interface QCGoalPanelProps {
  year: number
  targets: MultiDomainTarget[]
  onChange: (targets: MultiDomainTarget[]) => void
}

interface QCGoalRow {
  center: string
  attitude: number
  ops: number
  total: number
}

const DEFAULT_ROWS: QCGoalRow[] = [
  { center: "용산", attitude: 3.3, ops: 3.9, total: 3.6 },
  { center: "광주", attitude: 2.7, ops: 1.7, total: 2.2 },
  { center: "전체", attitude: 3.0, ops: 3.0, total: 3.0 },
]

export function QCGoalPanel({ year, targets, onChange }: QCGoalPanelProps) {
  const [rows, setRows] = useState<QCGoalRow[]>(DEFAULT_ROWS)
  const [changed, setChanged] = useState<Record<string, boolean>>({})

  // 서버 데이터가 있으면 반영
  useEffect(() => {
    if (targets.length === 0) {
      setRows(DEFAULT_ROWS)
      setChanged({})
      return
    }

    const newRows = DEFAULT_ROWS.map((defaultRow) => {
      const row = { ...defaultRow }
      const centerTargets = targets.filter((t) => t.center === row.center)
      for (const t of centerTargets) {
        if (t.targetSubtype === "상담태도") row.attitude = t.targetValue
        else if (t.targetSubtype === "오상담") row.ops = t.targetValue
        else if (t.targetSubtype === "합계") row.total = t.targetValue
      }
      return row
    })
    setRows(newRows)
    setChanged({})
  }, [targets])

  const handleChange = (centerIdx: number, field: "attitude" | "ops" | "total", value: string) => {
    const num = value === "" ? 0 : parseFloat(value)
    if (isNaN(num)) return

    const newRows = [...rows]
    newRows[centerIdx] = { ...newRows[centerIdx], [field]: num }
    setRows(newRows)

    const key = `${centerIdx}-${field}`
    setChanged((prev) => ({ ...prev, [key]: true }))

    // 변경 사항을 부모에게 전달
    const allTargets: MultiDomainTarget[] = []
    for (const row of newRows) {
      const subtypes = [
        { subtype: "상담태도", value: row.attitude },
        { subtype: "오상담", value: row.ops },
        { subtype: "합계", value: row.total },
      ]
      for (const st of subtypes) {
        allTargets.push({
          domain: "qc",
          year,
          center: row.center,
          targetSubtype: st.subtype,
          targetValue: st.value,
          targetUnit: "%",
          isActive: true,
        })
      }
    }
    onChange(allTargets)
  }

  const cellBg = (centerIdx: number, field: string) =>
    changed[`${centerIdx}-${field}`] ? "bg-yellow-50 border-yellow-300" : ""

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">QC 오류율 목표</CardTitle>
            <CardDescription>센터별 상담태도/오상담 오류율 목표를 설정합니다.</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">단위: %</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">센터</TableHead>
              <TableHead>상담태도 목표(%)</TableHead>
              <TableHead>오상담 목표(%)</TableHead>
              <TableHead>합계 목표(%)</TableHead>
              <TableHead className="text-muted-foreground">현재 실적</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={row.center}>
                <TableCell className="font-medium">{row.center}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={row.attitude}
                    onChange={(e) => handleChange(idx, "attitude", e.target.value)}
                    className={`w-24 h-8 text-center ${cellBg(idx, "attitude")}`}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={row.ops}
                    onChange={(e) => handleChange(idx, "ops", e.target.value)}
                    className={`w-24 h-8 text-center ${cellBg(idx, "ops")}`}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={row.total}
                    onChange={(e) => handleChange(idx, "total", e.target.value)}
                    className={`w-24 h-8 text-center ${cellBg(idx, "total")}`}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  <span className="text-xs italic">Phase 2</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
