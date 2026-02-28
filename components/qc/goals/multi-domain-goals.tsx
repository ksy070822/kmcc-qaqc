"use client"

import { useState, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Save, Target } from "lucide-react"
import { toast } from "sonner"
import { useTargets } from "@/hooks/use-targets"
import { QCGoalPanel } from "./qc-goal-panel"
import { QAGoalPanel } from "./qa-goal-panel"
import { CSATGoalPanel } from "./csat-goal-panel"
import { SLAGoalPanel } from "./sla-goal-panel"
import { ProductivityGoalPanel } from "./productivity-goal-panel"
import type { MultiDomainTarget, TargetDomain } from "@/lib/types"

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

const DOMAIN_LABELS: Record<TargetDomain, string> = {
  qc: "QC",
  qa: "QA",
  csat: "CSAT",
  sla: "SLA",
  productivity: "생산성",
}

export function MultiDomainGoalManagement() {
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR)
  const [activeDomain, setActiveDomain] = useState<TargetDomain>("qc")

  // 각 도메인별 변경된 목표를 추적
  const pendingChanges = useRef<Record<string, MultiDomainTarget[]>>({})
  const [hasChanges, setHasChanges] = useState(false)

  const { data: targets, loading, saving, saveTarget, refetch } = useTargets({
    year: selectedYear,
  })

  // 도메인별 목표 필터링
  const getTargetsForDomain = useCallback(
    (domain: TargetDomain) => targets.filter((t) => t.domain === domain),
    [targets]
  )

  // 패널에서 변경 시 호출
  const handleDomainChange = useCallback(
    (domain: TargetDomain, domainTargets: MultiDomainTarget[]) => {
      pendingChanges.current[domain] = domainTargets
      setHasChanges(true)
    },
    []
  )

  // 저장
  const handleSave = async () => {
    const allChanges = Object.values(pendingChanges.current).flat()
    if (allChanges.length === 0) {
      toast.info("변경된 목표가 없습니다.")
      return
    }

    let successCount = 0
    let failCount = 0

    for (const target of allChanges) {
      const result = await saveTarget(target)
      if (result) {
        successCount++
      } else {
        failCount++
      }
    }

    if (failCount === 0) {
      toast.success(`${successCount}개 목표가 저장되었습니다.`)
      pendingChanges.current = {}
      setHasChanges(false)
      refetch()
    } else {
      toast.error(`${failCount}개 목표 저장에 실패했습니다. (${successCount}개 성공)`)
    }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2c6edb]/10">
                <Target className="h-5 w-5 text-[#2c6edb]" />
              </div>
              <div>
                <CardTitle className="text-lg">통합 목표관리</CardTitle>
                <p className="text-sm text-muted-foreground">
                  QC, QA, CSAT, SLA, 생산성 도메인별 목표를 설정하고 관리합니다.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* 연도 선택기 */}
              <Select
                value={String(selectedYear)}
                onValueChange={(v) => {
                  setSelectedYear(Number(v))
                  pendingChanges.current = {}
                  setHasChanges(false)
                }}
              >
                <SelectTrigger className="w-[120px] bg-white border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 저장 버튼 */}
              <Button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="bg-[#2c6edb] hover:bg-[#202237]"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                저장
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 도메인 탭 */}
      <Tabs
        value={activeDomain}
        onValueChange={(v) => setActiveDomain(v as TargetDomain)}
      >
        <TabsList className="w-full justify-start">
          {(Object.entries(DOMAIN_LABELS) as [TargetDomain, string][]).map(
            ([domain, label]) => (
              <TabsTrigger key={domain} value={domain} className="px-4">
                {label}
                {pendingChanges.current[domain] && (
                  <Badge
                    variant="outline"
                    className="ml-1.5 h-4 px-1 text-[10px] bg-yellow-100 text-yellow-700 border-yellow-300"
                  >
                    수정
                  </Badge>
                )}
              </TabsTrigger>
            )
          )}
        </TabsList>

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-muted-foreground">목표 데이터 로딩 중...</span>
            </CardContent>
          </Card>
        ) : (
          <>
            <TabsContent value="qc">
              <QCGoalPanel
                year={selectedYear}
                targets={getTargetsForDomain("qc")}
                onChange={(t) => handleDomainChange("qc", t)}
              />
            </TabsContent>

            <TabsContent value="qa">
              <QAGoalPanel
                year={selectedYear}
                targets={getTargetsForDomain("qa")}
                onChange={(t) => handleDomainChange("qa", t)}
              />
            </TabsContent>

            <TabsContent value="csat">
              <CSATGoalPanel
                year={selectedYear}
                targets={getTargetsForDomain("csat")}
                onChange={(t) => handleDomainChange("csat", t)}
              />
            </TabsContent>

            <TabsContent value="sla">
              <SLAGoalPanel
                year={selectedYear}
                targets={getTargetsForDomain("sla")}
                onChange={(t) => handleDomainChange("sla", t)}
              />
            </TabsContent>

            <TabsContent value="productivity">
              <ProductivityGoalPanel
                year={selectedYear}
                targets={getTargetsForDomain("productivity")}
                onChange={(t) => handleDomainChange("productivity", t)}
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* 변경 알림 바 */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-lg shadow-lg">
            <span className="text-sm">저장되지 않은 변경사항이 있습니다.</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Save className="mr-1 h-3 w-3" />
              )}
              저장
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
