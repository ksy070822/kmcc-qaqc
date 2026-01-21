"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { groups } from "@/lib/mock-data"
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
  const [group, setGroup] = useState<string>("")
  const [targetErrorRate, setTargetErrorRate] = useState("")
  const [period, setPeriod] = useState<"monthly" | "quarterly">("monthly")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    if (goal) {
      setTitle(goal.title)
      setCenter(goal.center)
      setGroup(goal.group || "")
      setTargetErrorRate(goal.targetErrorRate.toString())
      setPeriod(goal.period)
      setStartDate(goal.startDate)
      setEndDate(goal.endDate)
    } else {
      setTitle("")
      setCenter("전체")
      setGroup("")
      setTargetErrorRate("")
      setPeriod("monthly")
      setStartDate("")
      setEndDate("")
    }
  }, [goal, open])

  const handleSave = () => {
    onSave({
      id: goal?.id,
      title,
      center,
      group: group || undefined,
      targetErrorRate: Number(targetErrorRate),
      period,
      startDate,
      endDate,
    })
    onOpenChange(false)
  }

  const availableGroups = center === "전체" ? [] : center === "용산" ? groups["용산"] : groups["광주"]

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
              <Label>센터</Label>
              <Select value={center} onValueChange={(v: any) => setCenter(v)}>
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
              <Label>그룹 (선택)</Label>
              <Select value={group} onValueChange={setGroup} disabled={center === "전체"}>
                <SelectTrigger className="bg-secondary">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="전체">전체</SelectItem>
                  {availableGroups.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="targetRate">목표 오류율 (%) *</Label>
              <Input
                id="targetRate"
                type="number"
                step="0.1"
                placeholder="3.0"
                value={targetErrorRate}
                onChange={(e) => setTargetErrorRate(e.target.value)}
                className="bg-secondary"
              />
            </div>

            <div className="space-y-2">
              <Label>기간 유형</Label>
              <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                <SelectTrigger className="bg-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">월간</SelectItem>
                  <SelectItem value="quarterly">분기</SelectItem>
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
