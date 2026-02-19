"use client"

import { WeeklyReportForm } from "@/components/qc/focus/weekly-report-form"
import { WeeklyReportHistory } from "@/components/qc/focus/weekly-report-history"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClipboardList, History } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

export default function WeeklyReportPage() {
  const { user } = useAuth()
  const center = user?.center || undefined
  const service = user?.service || undefined

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">주간보고</h1>
        <p className="text-sm text-slate-500 mt-1">
          주간 활동 내용과 부진 항목을 작성하고 제출합니다.
        </p>
      </div>

      <Tabs defaultValue="write" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="write" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            보고서 작성
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            작성 이력
          </TabsTrigger>
        </TabsList>

        <TabsContent value="write" className="mt-4">
          <WeeklyReportForm center={center} service={service} />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <WeeklyReportHistory center={center} service={service} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
