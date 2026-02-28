"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { groups } from "@/lib/constants"
import type { GoalData } from "./goal-card"

interface GoalFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal?: GoalData | null
  onSave: (goal: Partial<GoalData>) => void
}

export function GoalFormModal({ open, onOpenChange, goal, onSave }: GoalFormModalProps) {
  const [title, setTitle] = useState("")
  const [center, setCenter] = useState<"전체" | "용산" | "광주">("전체")
  // Group is replaced by Service/Channel logic basically, but keeping interface consistent for now
  const [targetErrorRate, setTargetErrorRate] = useState("")
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "yearly">("monthly")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // New fields
  const [type, setType] = useState<"attitude" | "ops" | "total">("total")
  const [service, setService] = useState<string>("all")
  const [channel, setChannel] = useState<string>("all")

  useEffect(() => {
    if (goal) {
      setTitle(goal.title)
      setCenter(goal.center)
      setTargetErrorRate(goal.targetErrorRate.toString())
      setPeriod((goal.period || "monthly") as "monthly" | "quarterly" | "yearly")
      setStartDate(goal.startDate)
      setEndDate(goal.endDate)

      // Initialize new fields from goal data if available, otherwise defaults
      setType(goal.type === "attitude" ? "attitude" : goal.type === "counseling" ? "ops" : "total")
      // Currently GoalData interface might need updates to hold service/channel, 
      // but for now we default to 'all' or infer if we added it to GoalData.
      // Assuming GoalData doesn't have them yet, defaulting to all.
      setService("all")
      setChannel("all")
    } else {
      setTitle("")
      setCenter("전체")
      setTargetErrorRate("")
      setPeriod("monthly")
      setStartDate("")
      setEndDate("")
      setType("total")
      setService("all")
      setChannel("all")
    }
  }, [goal, open])

  const handleSave = () => {
    onSave({
      id: goal?.id,
      title,
      center,
      targetErrorRate: Number(targetErrorRate),
      period,
      startDate,
      endDate,
      // Pass new fields. Note: onSave expects Partial<GoalData>. 
      // We will cast these into the object, and index.tsx needs to handle them.
      type: type === "attitude" ? "attitude" : type === "ops" ? "counseling" : "total",
      // @ts-ignore - appending temporary fields that will be handled in index.tsx
      service: service === "all" ? undefined : service,
      // @ts-ignore
      channel: channel === "all" ? undefined : channel,
    } as Partial<GoalData>)
    onOpenChange(false)
  }

  // Mock services data
  const services = {
    "용산": ["모빌리티", "T map", "NUGU"],
    "광주": ["택시", "대리", "주차", "바이크"],
  }

  const currentServices = center === "용산" ? services["용산"] : center === "광주" ? services["광주"] : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{goal ? "목표 수정" : "새 목표 등록"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">목표명 *</Label>
            <Input
              id="title"
              placeholder="예: 12월 전체 품질 목표"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-secondary"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>목표 유형 *</Label>
              <Select value={type} onValueChange={(v) => setType(v as "attitude" | "ops" | "total")}>
                <SelectTrigger className="bg-secondary">
                  <SelectValue placeholder="유형 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="attitude">상담태도</SelectItem>
                  <SelectItem value="ops">오상담/오처리</SelectItem>
                  <SelectItem value="total">합계</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetRate">목표 오류율 (%) *</Label>
              <Input
                id="targetRate"
                type="number"
                step="0.1"
                value={targetErrorRate}
                onChange={(e) => setTargetErrorRate(e.target.value)}
                className="bg-secondary"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>센터</Label>
              <Select value={center} onValueChange={(v) => setCenter(v as "전체" | "용산" | "광주")}>
                <SelectTrigger className="bg-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="전체">전체</SelectItem>
                  <SelectItem value="용산">용산</SelectItem>
                  <SelectItem value="광주">광주</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>기간 유형</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as "monthly" | "quarterly" | "yearly")}>
                <SelectTrigger className="bg-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">월간</SelectItem>
                  <SelectItem value="quarterly">분기</SelectItem>
                  <SelectItem value="yearly">연간</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>서비스 (선택)</Label>
              <Select value={service} onValueChange={setService} disabled={center === "전체"}>
                <SelectTrigger className="bg-secondary">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {currentServices.map((svc) => (
                    <SelectItem key={svc} value={svc}>
                      {svc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>채널 (선택)</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="bg-secondary">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="chat">채팅</SelectItem>
                  <SelectItem value="call">유선</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">시작일 *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-secondary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">종료일 *</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-secondary"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={!title || !targetErrorRate || !startDate || !endDate}>
            {goal ? "수정" : "등록"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
