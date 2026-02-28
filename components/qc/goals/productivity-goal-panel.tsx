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

interface ProductivityGoalPanelProps {
  year: number
  targets: MultiDomainTarget[]
  onChange: (targets: MultiDomainTarget[]) => void
}

interface ProductivityGoalRow {
  subtype: string
  value: number
}

const DEFAULT_ROWS: ProductivityGoalRow[] = [
  { subtype: "유선 응답률", value: 85 },
  { subtype: "채팅 응답률", value: 90 },
]

export function ProductivityGoalPanel({ year, targets, onChange }: ProductivityGoalPanelProps) {
  const [rows, setRows] = useState<ProductivityGoalRow[]>(DEFAULT_ROWS)
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
      domain: "productivity",
      year,
      center: "전체",
      targetSubtype: row.subtype,
      targetValue: row.value,
      targetUnit: "%",
      isActive: true,
    }))
    onChange(allTargets)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">생산성 목표</CardTitle>
            <CardDescription>유선/채팅 응답률 목표를 설정합니다.</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">단위: %</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">항목</TableHead>
              <TableHead>목표(%)</TableHead>
              <TableHead className="text-muted-foreground">현재 실적</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={row.subtype}>
                <TableCell className="font-medium">{row.subtype}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
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
