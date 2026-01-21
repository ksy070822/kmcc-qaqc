"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User, AlertTriangle } from "lucide-react"
import type { WatchlistAgent } from "./watchlist-table"

interface ActionPlanModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agent: WatchlistAgent | null
  onSave: (plan: ActionPlanData) => void
}

export interface ActionPlanData {
  agentId: string
  issue: string
  plan: string
  targetDate: string
  status: "pending" | "in-progress" | "completed"
  notes?: string
}

export function ActionPlanModal({ open, onOpenChange, agent, onSave }: ActionPlanModalProps) {
  const [issue, setIssue] = useState("")
  const [plan, setPlan] = useState("")
  const [targetDate, setTargetDate] = useState("")
  const [status, setStatus] = useState<"pending" | "in-progress" | "completed">("pending")
  const [notes, setNotes] = useState("")

  const handleSave = () => {
    if (!agent || !issue || !plan || !targetDate) return

    onSave({
      agentId: agent.id,
      issue,
      plan,
      targetDate,
      status,
      notes: notes || undefined,
    })

    setIssue("")
    setPlan("")
    setTargetDate("")
    setStatus("pending")
    setNotes("")
    onOpenChange(false)
  }

  if (!agent) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            액션플랜 등록
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1e3a5f]/10">
                  <User className="h-6 w-6 text-[#1e3a5f]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-semibold text-slate-900">{agent.name}</span>
                    <Badge variant="outline" className="bg-white border-slate-200">
                      {agent.center} {agent.group}
                    </Badge>
                    <Badge variant="outline" className="bg-white border-slate-200">
                      {agent.channel}
                    </Badge>
                    <Badge variant="outline" className="bg-white border-slate-200">
                      {agent.tenure}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-sm text-slate-500 flex-wrap">
                    <span>태도: {agent.attitudeRate?.toFixed(2) || "0.00"}%</span>
                    <span>업무: {agent.counselingRate?.toFixed(2) || "0.00"}%</span>
                    <span className="font-medium text-red-600">전체: {agent.errorRate.toFixed(2)}%</span>
                    <span>등재: {agent.daysOnList}일</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    주요이슈: <span className="font-medium">{agent.mainIssue}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="issue" className="text-slate-700">
                문제점 *
              </Label>
              <Textarea
                id="issue"
                placeholder="상담사의 주요 문제점을 기술하세요"
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                className="bg-white border-slate-200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan" className="text-slate-700">
                개선 계획 *
              </Label>
              <Textarea
                id="plan"
                placeholder="구체적인 개선 계획을 입력하세요"
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="bg-white border-slate-200 min-h-[100px]"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="targetDate" className="text-slate-700">
                  목표일 *
                </Label>
                <Input
                  id="targetDate"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="bg-white border-slate-200"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className="text-slate-700">
                  상태
                </Label>
                <Select value={status} onValueChange={(v: "pending" | "in-progress" | "completed") => setStatus(v)}>
                  <SelectTrigger className="bg-white border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">대기</SelectItem>
                    <SelectItem value="in-progress">진행중</SelectItem>
                    <SelectItem value="completed">완료</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-slate-700">
                비고
              </Label>
              <Textarea
                id="notes"
                placeholder="추가 메모 (선택)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-white border-slate-200"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-200 bg-transparent">
            취소
          </Button>
          <Button
            onClick={handleSave}
            disabled={!issue || !plan || !targetDate}
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
          >
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
