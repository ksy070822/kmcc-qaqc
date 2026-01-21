"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertSettings } from "./alert-settings"
import { SlackSettings } from "./slack-settings"
import { DataSyncSettings } from "./data-sync-settings"
import { GoalSettings } from "./goal-settings"
import { Bell, Database, Target } from "lucide-react"

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">설정</h1>
        <p className="text-sm text-slate-500">목표, 알림, Slack 연동, 데이터 동기화를 설정합니다.</p>
      </div>

      <Tabs defaultValue="goals" className="space-y-4">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="goals" className="gap-2 data-[state=active]:bg-white">
            <Target className="h-4 w-4" />
            목표 설정
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2 data-[state=active]:bg-white">
            <Bell className="h-4 w-4" />
            알림 설정
          </TabsTrigger>
          <TabsTrigger value="slack" className="gap-2 data-[state=active]:bg-white">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
            </svg>
            Slack 연동
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-2 data-[state=active]:bg-white">
            <Database className="h-4 w-4" />
            데이터 동기화
          </TabsTrigger>
        </TabsList>

        <TabsContent value="goals">
          <GoalSettings />
        </TabsContent>

        <TabsContent value="alerts">
          <AlertSettings />
        </TabsContent>

        <TabsContent value="slack">
          <SlackSettings />
        </TabsContent>

        <TabsContent value="sync">
          <DataSyncSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}
