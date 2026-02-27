"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, UserPlus, AlertTriangle, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useWatchList } from "@/hooks/use-watchlist"
import type { UnderperformingRegistration } from "@/lib/types"

interface AgentPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  center?: string
  service?: string
  onSelect: (agent: UnderperformingRegistration) => void
  excludeAgentIds?: string[]
}

// QC 평가 항목 코드 → 한글 매핑
const QC_ITEM_LABELS: Record<string, string> = {
  att1: "첫인사/끝인사 누락",
  att2: "공감표현 누락",
  att3: "사과표현 누락",
  att4: "추가문의 누락",
  att5: "불친절",
  err1: "상담유형 오설정",
  err2: "가이드 미준수",
  err3: "본인확인 누락",
  err4: "필수탐색 누락",
  err5: "오안내",
  err6: "전산처리 누락",
  err7: "전산처리 미흡/정정",
  err8: "전산조작 미흡/오류",
  err9: "콜픽/트립ID 매핑 누락/오기재",
  err10: "플래그/키워드 누락/오기재",
  err11: "상담이력 기재 미흡",
}

export function AgentPicker({
  open,
  onOpenChange,
  center,
  service,
  onSelect,
  excludeAgentIds = [],
}: AgentPickerProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [coachingNote, setCoachingNote] = useState("")
  const [improvementPlan, setImprovementPlan] = useState("")
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  // 유의상담사 목록에서 AI 추천 후보 가져오기
  const { data: watchlistAgents, loading } = useWatchList({
    center: center !== "all" ? center : undefined,
  })

  // 필터링 + 제외 처리
  const filteredAgents = useMemo(() => {
    const agents = (watchlistAgents || []).filter(
      (a) => !excludeAgentIds.includes(a.agentId),
    )

    if (!searchQuery.trim()) return agents

    const query = searchQuery.toLowerCase()
    return agents.filter(
      (a) =>
        a.agentName.toLowerCase().includes(query) ||
        a.agentId.toLowerCase().includes(query) ||
        a.center.includes(query) ||
        a.service.includes(query),
    )
  }, [watchlistAgents, excludeAgentIds, searchQuery])

  const selectedAgent = useMemo(
    () => filteredAgents.find((a) => a.agentId === selectedAgentId),
    [filteredAgents, selectedAgentId],
  )

  const handleConfirm = () => {
    if (!selectedAgent) return

    onSelect({
      agentId: selectedAgent.agentId,
      agentName: selectedAgent.agentName,
      center: selectedAgent.center,
      service: selectedAgent.service,
      channel: selectedAgent.channel,
      registrationReason: reason || selectedAgent.reason || "오류율 기준 초과",
      problematicItems: selectedItems.length > 0 ? selectedItems : (selectedAgent.topErrors || []),
      baselineAttitudeRate: selectedAgent.attitudeRate,
      baselineOpsRate: selectedAgent.opsRate,
      baselineEvaluationCount: selectedAgent.evaluationCount,
      coachingNote,
      improvementPlan,
    })

    // 초기화
    setSelectedAgentId(null)
    setReason("")
    setCoachingNote("")
    setImprovementPlan("")
    setSelectedItems([])
  }

  const toggleItem = (item: string) => {
    setSelectedItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item],
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-white max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <UserPlus className="h-5 w-5 text-[#1e3a5f]" />
            부진상담사 선택
          </DialogTitle>
        </DialogHeader>

        {/* 검색 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="상담사 이름 또는 ID로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white border-slate-200"
          />
        </div>

        {/* AI 추천 안내 */}
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>유의상담사 목록에서 AI가 추천한 부진 후보입니다. 직접 입력도 가능합니다.</span>
        </div>

        {/* 상담사 목록 */}
        {!selectedAgentId ? (
          <div className="rounded-lg border border-slate-200 overflow-x-auto max-h-[300px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead>상담사</TableHead>
                  <TableHead>센터</TableHead>
                  <TableHead>서비스</TableHead>
                  <TableHead>채널</TableHead>
                  <TableHead className="text-right">태도</TableHead>
                  <TableHead className="text-right">오상담</TableHead>
                  <TableHead>주요이슈</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                      데이터 로딩 중...
                    </TableCell>
                  </TableRow>
                ) : filteredAgents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                      {searchQuery ? "검색 결과가 없습니다." : "유의상담사가 없습니다."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAgents.map((agent) => (
                    <TableRow
                      key={agent.agentId}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => setSelectedAgentId(agent.agentId)}
                    >
                      <TableCell className="font-medium text-slate-900">
                        {agent.agentId} / {agent.agentName}
                      </TableCell>
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
                      <TableCell className="text-slate-600">{agent.service}</TableCell>
                      <TableCell className="text-slate-600">{agent.channel}</TableCell>
                      <TableCell className="text-right">
                        <span className={cn("font-mono", agent.attitudeRate > 10 ? "text-red-600 font-bold" : "text-slate-600")}>
                          {agent.attitudeRate.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn("font-mono", agent.opsRate > 10 ? "text-red-600 font-bold" : "text-slate-600")}>
                          {agent.opsRate.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 max-w-[150px] truncate">
                        {agent.reason || "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-200 bg-transparent"
                        >
                          선택
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : selectedAgent ? (
          /* 선택된 상담사 상세 입력 */
          <div className="space-y-4">
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {selectedAgent.agentId} / {selectedAgent.agentName}
                      </span>
                      <Badge variant="outline" className="bg-white text-xs">
                        {selectedAgent.center} {selectedAgent.service}/{selectedAgent.channel}
                      </Badge>
                    </div>
                    <div className="text-sm text-slate-500 mt-0.5">
                      태도: {selectedAgent.attitudeRate.toFixed(1)}% | 오상담: {selectedAgent.opsRate.toFixed(1)}%
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedAgentId(null)}
                    className="ml-auto text-slate-400"
                  >
                    다른 상담사 선택
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 문제 항목 선택 */}
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">문제 항목 (복수 선택 가능)</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(QC_ITEM_LABELS).map(([code, label]) => (
                  <Badge
                    key={code}
                    variant="outline"
                    className={cn(
                      "cursor-pointer transition-colors",
                      selectedItems.includes(code)
                        ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                        : "bg-white hover:bg-slate-100",
                    )}
                    onClick={() => toggleItem(code)}
                  >
                    {label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700">등록 사유</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={selectedAgent.reason || "오류율 기준 초과"}
                className="bg-white border-slate-200"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700">금주 코칭사항</Label>
                <Textarea
                  value={coachingNote}
                  onChange={(e) => setCoachingNote(e.target.value)}
                  placeholder="이번 주 코칭 내용을 입력하세요"
                  className="bg-white border-slate-200 min-h-[80px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">차주 개선계획</Label>
                <Textarea
                  value={improvementPlan}
                  onChange={(e) => setImprovementPlan(e.target.value)}
                  placeholder="다음 주 개선 계획을 입력하세요"
                  className="bg-white border-slate-200 min-h-[80px]"
                />
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-200 bg-transparent">
            취소
          </Button>
          {selectedAgentId && (
            <Button
              onClick={handleConfirm}
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              등록
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
