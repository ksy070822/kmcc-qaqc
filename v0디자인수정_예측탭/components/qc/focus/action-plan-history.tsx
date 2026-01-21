"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Calendar, CheckCircle, Clock, AlertTriangle, ChevronRight, TrendingDown, MessageSquare } from "lucide-react"

interface ActionPlanHistoryItem {
  id: string
  agentName: string
  center: string
  group: string
  issue: string
  plan: string
  createdAt: string
  targetDate: string
  status: "pending" | "in-progress" | "completed" | "delayed"
  result?: string
  improvement?: number
  managerFeedback?: string
  feedbackDate?: string
}

interface ActionPlanHistoryProps {
  plans: ActionPlanHistoryItem[]
  onViewDetail: (plan: ActionPlanHistoryItem) => void
}

export function ActionPlanHistory({ plans, onViewDetail }: ActionPlanHistoryProps) {
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<ActionPlanHistoryItem | null>(null)

  const getStatusConfig = (status: ActionPlanHistoryItem["status"]) => {
    switch (status) {
      case "pending":
        return {
          icon: Clock,
          label: "대기",
          className: "bg-gray-100 text-gray-600 border-gray-300",
        }
      case "in-progress":
        return {
          icon: Clock,
          label: "진행중",
          className: "bg-blue-100 text-blue-700 border-blue-300",
        }
      case "completed":
        return {
          icon: CheckCircle,
          label: "완료",
          className: "bg-green-100 text-green-700 border-green-300",
        }
      case "delayed":
        return {
          icon: AlertTriangle,
          label: "지연",
          className: "bg-red-100 text-red-700 border-red-300",
        }
    }
  }

  const handleViewFeedback = (plan: ActionPlanHistoryItem) => {
    setSelectedPlan(plan)
    setFeedbackModalOpen(true)
  }

  return (
    <>
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-base text-slate-900">액션플랜 이력</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {plans.map((plan) => {
            const statusConfig = getStatusConfig(plan.status)
            const StatusIcon = statusConfig.icon

            return (
              <div
                key={plan.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900">{plan.agentName}</span>
                    <Badge variant="outline" className="text-xs bg-white border-slate-200">
                      {plan.center} {plan.group}
                    </Badge>
                    <Badge className={cn("text-xs", statusConfig.className)}>
                      <StatusIcon className="mr-1 h-3 w-3" />
                      {statusConfig.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-1">{plan.issue}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      등록: {plan.createdAt}
                    </span>
                    <span>목표: {plan.targetDate}</span>
                    {plan.improvement && (
                      <span className="flex items-center gap-1 text-green-600 font-medium">
                        <TrendingDown className="h-3 w-3" />
                        {plan.improvement}% 개선
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  {plan.managerFeedback && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs bg-[#fee500]/20 border-[#fee500] text-slate-700 hover:bg-[#fee500]/30"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleViewFeedback(plan)
                      }}
                    >
                      <MessageSquare className="mr-1 h-3 w-3" />
                      피드백
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => onViewDetail(plan)}>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Button>
                </div>
              </div>
            )
          })}

          {plans.length === 0 && <div className="py-8 text-center text-slate-500">등록된 액션플랜이 없습니다.</div>}
        </CardContent>
      </Card>

      <Dialog open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <MessageSquare className="h-5 w-5 text-[#1e3a5f]" />
              관리자 피드백
            </DialogTitle>
          </DialogHeader>
          {selectedPlan && (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-slate-900">{selectedPlan.agentName}</span>
                  <Badge variant="outline" className="text-xs bg-white border-slate-200">
                    {selectedPlan.center} {selectedPlan.group}
                  </Badge>
                </div>
                <p className="text-sm text-slate-600">{selectedPlan.issue}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-2">실행 계획</h4>
                <p className="text-sm text-slate-700">{selectedPlan.plan}</p>
              </div>
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-sm font-medium text-slate-500 mb-2">관리자 피드백</h4>
                <div className="rounded-lg border border-[#1e3a5f]/30 bg-[#1e3a5f]/5 p-3">
                  <p className="text-sm text-slate-700">{selectedPlan.managerFeedback}</p>
                  {selectedPlan.feedbackDate && (
                    <p className="text-xs text-slate-500 mt-2">작성일: {selectedPlan.feedbackDate}</p>
                  )}
                </div>
              </div>
              {selectedPlan.result && (
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-2">결과</h4>
                  <p className="text-sm text-green-600 font-medium">{selectedPlan.result}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
