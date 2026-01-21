"use client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { FileEdit, TrendingUp, TrendingDown, AlertTriangle, Clock, CheckCircle } from "lucide-react"

export interface WatchlistAgent {
  id: string
  name: string
  center: string
  group: string
  channel: string
  tenure: string
  errorRate: number
  attitudeRate: number
  counselingRate: number
  trend: number
  daysOnList: number
  mainIssue: string
  actionPlanStatus: "none" | "pending" | "in-progress" | "completed"
  lastActionDate?: string
}

interface WatchlistTableProps {
  agents: WatchlistAgent[]
  selectedAgents: string[]
  onSelectAgent: (id: string) => void
  onSelectAll: () => void
  onCreatePlan: (agent: WatchlistAgent) => void
}

export function WatchlistTable({
  agents,
  selectedAgents,
  onSelectAgent,
  onSelectAll,
  onCreatePlan,
}: WatchlistTableProps) {
  const getStatusBadge = (status: WatchlistAgent["actionPlanStatus"]) => {
    switch (status) {
      case "none":
        return (
          <Badge className="bg-gray-100 text-gray-600 border-gray-300">
            <AlertTriangle className="mr-1 h-3 w-3" />
            미등록
          </Badge>
        )
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">
            <Clock className="mr-1 h-3 w-3" />
            대기
          </Badge>
        )
      case "in-progress":
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-300">
            <Clock className="mr-1 h-3 w-3" />
            진행중
          </Badge>
        )
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-700 border-green-300">
            <CheckCircle className="mr-1 h-3 w-3" />
            완료
          </Badge>
        )
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead className="w-[50px]">
              <Checkbox
                checked={selectedAgents.length === agents.length && agents.length > 0}
                onCheckedChange={onSelectAll}
              />
            </TableHead>
            <TableHead>상담사</TableHead>
            <TableHead>센터</TableHead>
            <TableHead>그룹</TableHead>
            <TableHead>채널</TableHead>
            <TableHead>근속기간</TableHead>
            <TableHead className="text-right">태도 오류율</TableHead>
            <TableHead className="text-right">업무 오류율</TableHead>
            <TableHead className="text-right">전체 오류율</TableHead>
            <TableHead className="text-right">전일대비</TableHead>
            <TableHead className="text-center">등재일수</TableHead>
            <TableHead>주요이슈</TableHead>
            <TableHead>액션플랜</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent) => (
            <TableRow key={agent.id} className="hover:bg-slate-50">
              <TableCell>
                <Checkbox checked={selectedAgents.includes(agent.id)} onCheckedChange={() => onSelectAgent(agent.id)} />
              </TableCell>
              <TableCell className="font-medium text-slate-900">{agent.name}</TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn(
                    agent.center === "용산"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-yellow-50 text-yellow-700 border-yellow-200",
                  )}
                >
                  {agent.center}
                </Badge>
              </TableCell>
              <TableCell className="text-slate-600">{agent.group}</TableCell>
              <TableCell className="text-slate-600">{agent.channel}</TableCell>
              <TableCell className="text-slate-600">{agent.tenure}</TableCell>
              <TableCell className="text-right">
                <span className={cn("font-mono", agent.attitudeRate > 3 ? "text-red-600 font-bold" : "text-slate-600")}>
                  {agent.attitudeRate.toFixed(2)}%
                </span>
              </TableCell>
              <TableCell className="text-right">
                <span
                  className={cn("font-mono", agent.counselingRate > 4 ? "text-red-600 font-bold" : "text-slate-600")}
                >
                  {agent.counselingRate.toFixed(2)}%
                </span>
              </TableCell>
              <TableCell className="text-right">
                <span
                  className={cn(
                    "font-mono font-bold",
                    agent.errorRate > 7 ? "text-red-600" : agent.errorRate > 5 ? "text-amber-600" : "text-orange-500",
                  )}
                >
                  {agent.errorRate.toFixed(2)}%
                </span>
              </TableCell>
              <TableCell className="text-right">
                <span
                  className={cn(
                    "flex items-center justify-end gap-1 text-sm font-medium",
                    agent.trend > 0 ? "text-red-600" : "text-green-600",
                  )}
                >
                  {agent.trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {agent.trend > 0 ? "+" : ""}
                  {agent.trend.toFixed(2)}%
                </span>
              </TableCell>
              <TableCell className="text-center">
                <Badge
                  variant="outline"
                  className={cn(agent.daysOnList > 7 ? "bg-red-50 border-red-300 text-red-600" : "bg-slate-50")}
                >
                  {agent.daysOnList}일
                </Badge>
              </TableCell>
              <TableCell>
                <span className="text-sm text-slate-600">{agent.mainIssue}</span>
              </TableCell>
              <TableCell>{getStatusBadge(agent.actionPlanStatus)}</TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-200 hover:bg-slate-50 bg-transparent"
                  onClick={() => onCreatePlan(agent)}
                >
                  <FileEdit className="mr-1 h-3 w-3" />
                  {agent.actionPlanStatus === "none" ? "등록" : "수정"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
