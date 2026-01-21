"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Plus, Edit2, Trash2, Target, Save } from "lucide-react"

interface Goal {
  id: string
  name: string
  center: "전체" | "용산" | "광주"
  type: "attitude" | "counseling" | "total"
  targetRate: number
  period: "monthly" | "quarterly" | "yearly"
  startDate: string
  endDate: string
}

export function GoalSettings() {
  const [goals, setGoals] = useState<Goal[]>([
    {
      id: "1",
      name: "12월 전체 상담태도 목표",
      center: "전체",
      type: "attitude",
      targetRate: 2.0,
      period: "monthly",
      startDate: "2024-12-01",
      endDate: "2024-12-31",
    },
    {
      id: "2",
      name: "12월 전체 오상담/오처리 목표",
      center: "전체",
      type: "counseling",
      targetRate: 3.0,
      period: "monthly",
      startDate: "2024-12-01",
      endDate: "2024-12-31",
    },
    {
      id: "3",
      name: "12월 전체 품질 합계 목표",
      center: "전체",
      type: "total",
      targetRate: 3.0,
      period: "monthly",
      startDate: "2024-12-01",
      endDate: "2024-12-31",
    },
    {
      id: "4",
      name: "12월 용산센터 상담태도 목표",
      center: "용산",
      type: "attitude",
      targetRate: 2.0,
      period: "monthly",
      startDate: "2024-12-01",
      endDate: "2024-12-31",
    },
    {
      id: "5",
      name: "12월 용산센터 오상담/오처리 목표",
      center: "용산",
      type: "counseling",
      targetRate: 2.8,
      period: "monthly",
      startDate: "2024-12-01",
      endDate: "2024-12-31",
    },
    {
      id: "6",
      name: "12월 광주센터 상담태도 목표",
      center: "광주",
      type: "attitude",
      targetRate: 2.2,
      period: "monthly",
      startDate: "2024-12-01",
      endDate: "2024-12-31",
    },
    {
      id: "7",
      name: "12월 광주센터 오상담/오처리 목표",
      center: "광주",
      type: "counseling",
      targetRate: 3.2,
      period: "monthly",
      startDate: "2024-12-01",
      endDate: "2024-12-31",
    },
  ])

  const [modalOpen, setModalOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [filterCenter, setFilterCenter] = useState("all")

  const [formData, setFormData] = useState({
    name: "",
    center: "전체" as "전체" | "용산" | "광주",
    type: "total" as "attitude" | "counseling" | "total",
    targetRate: "",
    period: "monthly" as "monthly" | "quarterly" | "yearly",
    startDate: "",
    endDate: "",
  })

  const filteredGoals = useMemo(() => {
    if (filterCenter === "all") return goals
    return goals.filter((g) => g.center === filterCenter)
  }, [goals, filterCenter])

  const handleAddNew = () => {
    setEditingGoal(null)
    setFormData({
      name: "",
      center: "전체",
      type: "total",
      targetRate: "",
      period: "monthly",
      startDate: "",
      endDate: "",
    })
    setModalOpen(true)
  }

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal)
    setFormData({
      name: goal.name,
      center: goal.center,
      type: goal.type,
      targetRate: goal.targetRate.toString(),
      period: goal.period,
      startDate: goal.startDate,
      endDate: goal.endDate,
    })
    setModalOpen(true)
  }

  const handleDelete = (id: string) => {
    setGoals(goals.filter((g) => g.id !== id))
  }

  const handleSave = () => {
    if (editingGoal) {
      setGoals(
        goals.map((g) =>
          g.id === editingGoal.id
            ? {
                ...g,
                ...formData,
                targetRate: Number.parseFloat(formData.targetRate),
              }
            : g,
        ),
      )
    } else {
      setGoals([
        ...goals,
        {
          id: Date.now().toString(),
          ...formData,
          targetRate: Number.parseFloat(formData.targetRate),
        },
      ])
    }
    setModalOpen(false)
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "attitude":
        return "상담태도"
      case "counseling":
        return "오상담/오처리"
      case "total":
        return "합계"
      default:
        return type
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "attitude":
        return "bg-blue-100 text-blue-700 border-blue-200"
      case "counseling":
        return "bg-amber-100 text-amber-700 border-amber-200"
      case "total":
        return "bg-slate-100 text-slate-700 border-slate-200"
      default:
        return ""
    }
  }

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case "monthly":
        return "월간"
      case "quarterly":
        return "분기"
      case "yearly":
        return "연간"
      default:
        return period
    }
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <Target className="h-5 w-5 text-[#1e3a5f]" />
            목표 설정
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">센터별, 유형별 품질 목표를 설정합니다.</p>
        </div>
        <Button onClick={handleAddNew} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
          <Plus className="mr-2 h-4 w-4" />새 목표 추가
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Select value={filterCenter} onValueChange={setFilterCenter}>
            <SelectTrigger className="w-40 bg-white border-slate-200">
              <SelectValue placeholder="센터 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 센터</SelectItem>
              <SelectItem value="전체">전체</SelectItem>
              <SelectItem value="용산">용산</SelectItem>
              <SelectItem value="광주">광주</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold text-foreground">목표명</TableHead>
                <TableHead className="font-semibold text-foreground">센터</TableHead>
                <TableHead className="font-semibold text-foreground">유형</TableHead>
                <TableHead className="font-semibold text-foreground text-center">목표 오류율</TableHead>
                <TableHead className="font-semibold text-foreground">기간</TableHead>
                <TableHead className="font-semibold text-foreground">기간 유형</TableHead>
                <TableHead className="font-semibold text-foreground text-center">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGoals.map((goal) => (
                <TableRow key={goal.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium text-foreground">{goal.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-white">
                      {goal.center}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getTypeColor(goal.type)}>
                      {getTypeLabel(goal.type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-mono font-semibold text-[#1e3a5f]">
                    {goal.targetRate.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {goal.startDate} ~ {goal.endDate}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-white">
                      {getPeriodLabel(goal.period)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(goal)}>
                        <Edit2 className="h-4 w-4 text-slate-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(goal.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingGoal ? "목표 수정" : "새 목표 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>목표명 *</Label>
              <Input
                placeholder="예: 12월 전체 품질 목표"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-white border-slate-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>센터</Label>
                <Select value={formData.center} onValueChange={(v: any) => setFormData({ ...formData, center: v })}>
                  <SelectTrigger className="bg-white border-slate-200">
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
                <Label>유형</Label>
                <Select value={formData.type} onValueChange={(v: any) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger className="bg-white border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attitude">상담태도</SelectItem>
                    <SelectItem value="counseling">오상담/오처리</SelectItem>
                    <SelectItem value="total">합계</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>목표 오류율 (%) *</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="3.0"
                  value={formData.targetRate}
                  onChange={(e) => setFormData({ ...formData, targetRate: e.target.value })}
                  className="bg-white border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label>기간 유형</Label>
                <Select value={formData.period} onValueChange={(v: any) => setFormData({ ...formData, period: v })}>
                  <SelectTrigger className="bg-white border-slate-200">
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>시작일 *</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="bg-white border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label>종료일 *</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="bg-white border-slate-200"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name || !formData.targetRate || !formData.startDate || !formData.endDate}
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
            >
              <Save className="mr-2 h-4 w-4" />
              {editingGoal ? "수정" : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
