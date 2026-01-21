"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Hash, Send, CheckCircle, Loader2 } from "lucide-react"

export function SlackSettings() {
  const [webhookUrl, setWebhookUrl] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [channels, setChannels] = useState([
    { id: "1", name: "#qc-용산", enabled: true },
    { id: "2", name: "#qc-광주", enabled: true },
    { id: "3", name: "#qc-전체", enabled: true },
    { id: "4", name: "#qc-긴급알림", enabled: false },
  ])

  const [notifications, setNotifications] = useState({
    dailySummary: true,
    thresholdAlert: true,
    weeklyReport: true,
    actionPlanReminder: true,
  })

  const handleTestConnection = async () => {
    setIsTesting(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsConnected(true)
    setIsTesting(false)
  }

  const toggleChannel = (id: string) => {
    setChannels((prev) => prev.map((ch) => (ch.id === id ? { ...ch, enabled: !ch.enabled } : ch)))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
            </svg>
            Slack 연동
          </CardTitle>
          <CardDescription>Slack 웹훅을 설정하여 알림을 받으세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook">Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                id="webhook"
                type="url"
                placeholder="https://hooks.slack.com/services/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="bg-secondary flex-1"
              />
              <Button onClick={handleTestConnection} disabled={!webhookUrl || isTesting}>
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    테스트 중...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    연결 테스트
                  </>
                )}
              </Button>
            </div>
            {isConnected && (
              <div className="flex items-center gap-2 text-sm text-green-400">
                <CheckCircle className="h-4 w-4" />
                연결 성공
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>알림 채널</Label>
            <div className="space-y-2">
              {channels.map((channel) => (
                <div key={channel.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <span>{channel.name}</span>
                  </div>
                  <Switch checked={channel.enabled} onCheckedChange={() => toggleChannel(channel.id)} />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">알림 유형</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">일일 요약</p>
              <p className="text-sm text-muted-foreground">매일 오전 9시에 전일 QC 현황을 요약하여 발송</p>
            </div>
            <Switch
              checked={notifications.dailySummary}
              onCheckedChange={(checked) => setNotifications({ ...notifications, dailySummary: checked })}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">임계값 초과 알림</p>
              <p className="text-sm text-muted-foreground">그룹별 설정된 임계값 초과 시 즉시 알림</p>
            </div>
            <Switch
              checked={notifications.thresholdAlert}
              onCheckedChange={(checked) => setNotifications({ ...notifications, thresholdAlert: checked })}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">주간 리포트</p>
              <p className="text-sm text-muted-foreground">매주 월요일 주간 QC 리포트 자동 발송</p>
            </div>
            <Switch
              checked={notifications.weeklyReport}
              onCheckedChange={(checked) => setNotifications({ ...notifications, weeklyReport: checked })}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">액션플랜 리마인더</p>
              <p className="text-sm text-muted-foreground">액션플랜 목표일 도래 시 담당자에게 알림</p>
            </div>
            <Switch
              checked={notifications.actionPlanReminder}
              onCheckedChange={(checked) => setNotifications({ ...notifications, actionPlanReminder: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
