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

interface CSATGoalPanelProps {
  year: number
  targets: MultiDomainTarget[]
  onChange: (targets: MultiDomainTarget[]) => void
}

interface CSATGoalRow {
  subtype: string
  value: number
}

const DEFAULT_ROWS: CSATGoalRow[] = [
  { subtype: "전체", value: 4.70 },
  { subtype: "택시", value: 4.53 },
  { subtype: "바이크", value: 4.90 },
  { subtype: "주차", value: 4.87 },
  { subtype: "대리", value: 4.51 },
  { subtype: "퀵", value: 4.43 },
]

export function CSATGoalPanel({ year, targets, onChange }: CSATGoalPanelProps) {
  const [rows, setRows] = useState<CSATGoalRow[]>(DEFAULT_ROWS)
  const [changed, setChanged] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (targets.length === 0) {
      setRows(DEFAULT_ROWS)
      setChanged({})
      return
    }

    const newRows = DEFAULT_ROWS.map((defaultRow) => {
      const found = targets.find((t) => t.targetSubtype === defaultRow.subtype)
      return found ? { ...defaultRow, value: found.targetValue } : { ...defaultRow }
    })
    setRows(newRows)
    setChanged({})
  }, [targets])

  const handleChange = (idx: number, value: string) => {
    const num = value === "" ? 0 : parseFloat(value)
    if (isNaN(num)) return

    const newRows = [...rows]
    newRows[idx] = { ...newRows[idx], value: num }
    setRows(newRows)
    setChanged((prev) => ({ ...prev, [idx]: true }))

    const allTargets: MultiDomainTarget[] = newRows.map((row) => ({
      domain: "csat",
      year,
      center: "전체",
      targetSubtype: row.subtype,
      targetValue: row.value,
      targetUnit: "점",
      isActive: true,
    }))
    onChange(allTargets)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">상담평점(CSAT) 목표</CardTitle>
            <CardDescription>전체 및 서비스별 상담평점 목표를 설정합니다.</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">단위: 점 (5.0 만점)</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">서비스</TableHead>
              <TableHead>목표 평점</TableHead>
              <TableHead className="text-muted-foreground">현재 실적</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={row.subtype} className={idx === 0 ? "bg-slate-50" : ""}>
                <TableCell className={`font-medium ${idx === 0 ? "font-bold" : ""}`}>
                  {row.subtype}
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="5"
                    value={row.value}
                    onChange={(e) => handleChange(idx, e.target.value)}
                    className={`w-24 h-8 text-center ${changed[idx] ? "bg-yellow-50 border-yellow-300" : ""}`}
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
