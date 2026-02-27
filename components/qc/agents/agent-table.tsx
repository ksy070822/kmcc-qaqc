"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronUp, ChevronDown, Eye, TrendingUp, TrendingDown } from "lucide-react"

interface AgentRow {
  id: string
  name: string
  center: string
  group: string
  tenure: string
  errorRate: number
  trend: number | null
  totalCalls: number
  totalErrors: number
  topIssue: string
  status: "양호" | "위험"
}

interface AgentTableProps {
  agents: AgentRow[]
  onSelectAgent: (agent: AgentRow) => void
}

type SortField = "name" | "errorRate" | "totalCalls" | "trend"
type SortDirection = "asc" | "desc"

export function AgentTable({ agents, onSelectAgent }: AgentTableProps) {
  const [sortField, setSortField] = useState<SortField>("errorRate")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const sortedAgents = [...agents].sort((a, b) => {
    const multiplier = sortDirection === "asc" ? 1 : -1
    if (sortField === "name") {
      return multiplier * a.name.localeCompare(b.name)
    }
    // trend가 null인 경우 처리
    if (sortField === "trend") {
      const aTrend = a.trend ?? -Infinity
      const bTrend = b.trend ?? -Infinity
      return multiplier * (aTrend - bTrend)
    }
    return multiplier * (a[sortField] - b[sortField])
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
  }

  const getStatusBadge = (status: AgentRow["status"]) => {
    switch (status) {
      case "양호":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-300">양호</Badge>
      case "위험":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-red-300">위험</Badge>
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent bg-muted/30">
            <TableHead className="w-[80px]">상태</TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("name")}>
              <div className="flex items-center gap-1">
                상담사
                <SortIcon field="name" />
              </div>
            </TableHead>
            <TableHead>소속</TableHead>
            <TableHead>근속기간</TableHead>
            <TableHead className="cursor-pointer text-right" onClick={() => handleSort("errorRate")}>
              <div className="flex items-center justify-end gap-1">
                오류율
                <SortIcon field="errorRate" />
              </div>
            </TableHead>
            <TableHead className="cursor-pointer text-right" onClick={() => handleSort("trend")}>
              <div className="flex items-center justify-end gap-1">
                전일대비
                <SortIcon field="trend" />
              </div>
            </TableHead>
            <TableHead className="cursor-pointer text-right" onClick={() => handleSort("totalCalls")}>
              <div className="flex items-center justify-end gap-1">
                평가건수
                <SortIcon field="totalCalls" />
              </div>
            </TableHead>
            <TableHead>주요이슈</TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAgents.map((agent) => (
            <TableRow key={agent.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectAgent(agent)}>
              <TableCell>{getStatusBadge(agent.status)}</TableCell>
              <TableCell className="font-medium">{agent.id} / {agent.name}</TableCell>
              <TableCell>
                <span className="text-muted-foreground">
                  {agent.center} {agent.group}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {agent.tenure}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <span
                  className={cn(
                    "font-mono font-medium",
                    agent.errorRate > 5 ? "text-red-600" : agent.errorRate > 3 ? "text-amber-600" : "text-green-600",
                  )}
                >
                  {agent.errorRate.toFixed(2)}%
                </span>
              </TableCell>
              <TableCell className="text-right">
                {agent.trend === null || agent.trend === undefined ? (
                  <span className="text-sm text-muted-foreground">-</span>
                ) : agent.trend === 0 ? (
                  <span className="text-sm text-muted-foreground">0.00%</span>
                ) : (
                  <span
                    className={cn(
                      "flex items-center justify-end gap-1 text-sm",
                      agent.trend > 0 ? "text-red-600" : "text-green-600",
                    )}
                  >
                    {agent.trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {agent.trend > 0 ? "+" : ""}
                    {agent.trend.toFixed(2)}%
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono">{agent.totalCalls}</TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground truncate max-w-[120px] block">{agent.topIssue}</span>
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
