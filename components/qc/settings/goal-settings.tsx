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
import { Plus, Edit2, Trash2, Target, Save, Loader2 } from "lucide-react"
import { useGoals, type Goal } from "@/hooks/use-goals"

interface GoalDisplay {
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
  const [filterCenter, setFilterCenter] = useState("all")
  const [modalOpen, setModalOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<GoalDisplay | null>(null)
  const [saving, setSaving] = useState(false)

  // BigQuery에서 목표 데이터 가져오기
  const { data: goalsData, loading, error, refetch } = useGoals({
    center: filterCenter === "all" ? undefined : filterCenter,
    isActive: true,
  })

  // Goal 형식을 GoalDisplay 형식으로 변환
  const goals: GoalDisplay[] = useMemo(() => {
    if (!goalsData) return []
    
    return goalsData.map((goal) => ({
      id: goal.id,
      name: goal.name,
      center: (goal.center || "전체") as "전체" | "용산" | "광주",
      type: goal.type === "attitude" ? "attitude" : goal.type === "ops" ? "counseling" : "total",
      targetRate: goal.targetRate,
      period: goal.periodType as "monthly" | "quarterly" | "yearly",
      startDate: goal.periodStart,
      endDate: goal.periodEnd,
    }))
  }, [goalsData])

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

  // 날짜 형식을 YYYY-MM-DD로 변환 (date input 형식)
  const formatDateForInput = (dateStr: string): string => {
    if (!dateStr || typeof dateStr !== 'string') return ''
    
    const trimmed = dateStr.trim()
    if (!trimmed) return ''
    
    // 이미 YYYY-MM-DD 형식이면 그대로 반환
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed
    }
    
    // "2026. 01. 01." 또는 "2026.01.01" 형식을 "2026-01-01"로 변환
    if (trimmed.includes('.')) {
      const parts = trimmed.replace(/\./g, ' ').split(/\s+/).filter(p => p && p.length > 0)
      if (parts.length >= 3) {
        const year = parts[0].padStart(4, '0')
        const month = parts[1].padStart(2, '0')
        const day = parts[2].padStart(2, '0')
        return `${year}-${month}-${day}`
      }
    }
    
    // ISO 형식에서 날짜만 추출
    if (trimmed.includes('T')) {
      return trimmed.split('T')[0]
    }
    
    // 다른 형식 시도: 공백으로 구분된 날짜
    const spaceParts = trimmed.split(/\s+/).filter(p => p)
    if (spaceParts.length >= 3) {
      const year = spaceParts[0].padStart(4, '0')
      const month = spaceParts[1].padStart(2, '0')
      const day = spaceParts[2].padStart(2, '0')
      if (/^\d{4}$/.test(year) && /^\d{1,2}$/.test(month) && /^\d{1,2}$/.test(day)) {
        return `${year}-${month}-${day}`
      }
    }
    
    // 변환 실패 시 원본 반환 (경고는 하지만)
    console.warn('[GoalSettings] Could not format date:', dateStr)
    return trimmed
  }

  const handleEdit = (goal: GoalDisplay) => {
    setEditingGoal(goal)
    const formattedStartDate = formatDateForInput(goal.startDate)
    const formattedEndDate = formatDateForInput(goal.endDate)
    
    console.log('[GoalSettings] Editing goal:', {
      originalStartDate: goal.startDate,
      formattedStartDate,
      originalEndDate: goal.endDate,
      formattedEndDate,
    })
    
    setFormData({
      name: goal.name,
      center: goal.center,
      type: goal.type,
      targetRate: goal.targetRate.toString(),
      period: goal.period,
      startDate: formattedStartDate,
      endDate: formattedEndDate,
    })
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말로 이 목표를 삭제하시겠습니까?')) {
      return
    }

    try {
      const goalToDelete = goals.find(g => g.id === id)
      if (!goalToDelete) {
        alert('삭제할 목표를 찾을 수 없습니다.')
        return
      }

      // TODO: DELETE API 엔드포인트가 필요하면 추가
      // 현재는 isActive를 false로 설정하는 방식으로 처리
      const response = await fetch('/api/goals', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          name: goalToDelete.name,
          center: goalToDelete.center === '전체' ? null : goalToDelete.center,
          type: goalToDelete.type === 'attitude' ? 'attitude' : goalToDelete.type === 'counseling' ? 'ops' : 'total',
          targetRate: goalToDelete.targetRate,
          periodType: goalToDelete.period || 'monthly',
          periodStart: goalToDelete.startDate,
          periodEnd: goalToDelete.endDate,
          isActive: false,
        }),
      })

      const result = await response.json()

      if (result.success) {
        refetch()
      } else {
        alert(`목표 삭제 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Error deleting goal:', error)
      alert(`목표 삭제 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const handleSave = async () => {
    // 날짜 필드 검증 (빈 문자열도 체크)
    if (!formData.name || !formData.targetRate || !formData.startDate?.trim() || !formData.endDate?.trim()) {
      alert('필수 항목을 모두 입력해주세요.')
      return
    }

    setSaving(true)
    try {
      const isEdit = !!editingGoal
      const url = '/api/goals'
      const method = isEdit ? 'PUT' : 'POST'
      
      // 날짜 형식 검증 및 변환
      let periodStart = formData.startDate.trim()
      let periodEnd = formData.endDate.trim()
      
      // 날짜 형식이 "YYYY. MM. DD." 형식인 경우 "YYYY-MM-DD"로 변환
      if (periodStart.includes('.')) {
        periodStart = periodStart.replace(/\./g, '-').replace(/\s/g, '').replace(/-+/g, '-')
        if (periodStart.endsWith('-')) periodStart = periodStart.slice(0, -1)
      }
      if (periodEnd.includes('.')) {
        periodEnd = periodEnd.replace(/\./g, '-').replace(/\s/g, '').replace(/-+/g, '-')
        if (periodEnd.endsWith('-')) periodEnd = periodEnd.slice(0, -1)
      }
      
      // 날짜가 비어있거나 유효하지 않은 경우 오류
      if (!periodStart || !periodEnd) {
        alert('시작일과 종료일을 모두 입력해주세요.')
        setSaving(false)
        return
      }
      
      // YYYY-MM-DD 형식 검증
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(periodStart) || !dateRegex.test(periodEnd)) {
        alert(`날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.\n시작일: "${periodStart}", 종료일: "${periodEnd}"`)
        setSaving(false)
        return
      }
      
      // 날짜 유효성 검증 (실제 날짜인지 확인)
      const startDateObj = new Date(periodStart)
      const endDateObj = new Date(periodEnd)
      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        alert(`유효하지 않은 날짜입니다.\n시작일: "${periodStart}", 종료일: "${periodEnd}"`)
        setSaving(false)
        return
      }
      
      // 시작일이 종료일보다 늦으면 오류
      if (startDateObj > endDateObj) {
        alert('시작일이 종료일보다 늦을 수 없습니다.')
        setSaving(false)
        return
      }
      
      // GoalDisplay를 API 형식으로 변환
      const apiData = {
        ...(isEdit && editingGoal?.id ? { id: editingGoal.id } : {}),
        name: formData.name,
        center: formData.center === '전체' ? null : formData.center,
        type: formData.type === 'attitude' ? 'attitude' : formData.type === 'counseling' ? 'ops' : 'total',
        targetRate: Number.parseFloat(formData.targetRate),
        periodType: formData.period || 'monthly',
        periodStart: periodStart,
        periodEnd: periodEnd,
        isActive: true,
      }
      
      console.log('[GoalSettings] Sending API data:', apiData)
      console.log('[GoalSettings] Date values:', { 
        formDataStartDate: formData.startDate, 
        formDataEndDate: formData.endDate,
        periodStart, 
        periodEnd,
        startDateObj: startDateObj.toISOString(),
        endDateObj: endDateObj.toISOString(),
      })
      
      // 최종 검증: periodStart와 periodEnd가 비어있지 않은지 확인
      if (!periodStart || !periodEnd || periodStart.length === 0 || periodEnd.length === 0) {
        console.error('[GoalSettings] Dates are empty after processing:', { periodStart, periodEnd })
        alert('날짜를 다시 입력해주세요.')
        setSaving(false)
        return
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData),
      })
      
      const result = await response.json()
      
      if (result.success) {
        console.log(`Goal ${isEdit ? 'updated' : 'created'} successfully:`, result.data)
        setModalOpen(false)
        // 목표 목록 새로고침
        refetch()
      } else {
        console.error('Failed to save goal:', result.error)
        alert(`목표 저장 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Error saving goal:', error)
      alert(`목표 저장 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setSaving(false)
    }
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
            <Target className="h-5 w-5 text-[#2c6edb]" />
            목표 설정
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">센터별, 유형별 품질 목표를 설정합니다.</p>
        </div>
        <Button onClick={handleAddNew} className="bg-[#2c6edb] hover:bg-[#202237]">
          <Plus className="mr-2 h-4 w-4" />새 목표 추가
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
            <strong>데이터 로드 오류:</strong> {error}
          </div>
        )}

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

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>데이터 로딩 중...</span>
          </div>
        ) : (
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
                  <TableCell className="text-center font-mono font-semibold text-[#2c6edb]">
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
        )}
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
              disabled={!formData.name || !formData.targetRate || !formData.startDate || !formData.endDate || saving}
              className="bg-[#2c6edb] hover:bg-[#202237]"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {editingGoal ? "수정" : "저장"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
