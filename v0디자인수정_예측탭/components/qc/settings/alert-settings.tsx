"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Bell, Save } from "lucide-react"
import { groups } from "@/lib/mock-data"

interface AlertSetting {
  id: string
  group: string
  center: string
  attitudeThreshold: number
  counselingThreshold: number
  totalThreshold: number
  avgDays: number
  weekOverWeekThreshold: number
  manager: string
}

export function AlertSettings() {
  const [settings, setSettings] = useState<AlertSetting[]>(() => {
    const items: AlertSetting[] = []
    let idx = 1

    // 용산센터 그룹들
    groups["용산"].forEach((group) => {
      items.push({
        id: `yongsan-${idx}`,
        group,
        center: "용산",
        attitudeThreshold: 2.0,
        counselingThreshold: 3.0,
        totalThreshold: 5.0,
        avgDays: 3,
        weekOverWeekThreshold: 5,
        manager: `@may.0${(idx % 9) + 1}`,
      })
      idx++
    })

    // 광주센터 그룹들
    groups["광주"].forEach((group) => {
      items.push({
        id: `gwangju-${idx}`,
        group,
        center: "광주",
        attitudeThreshold: 2.0,
        counselingThreshold: 3.0,
        totalThreshold: 5.0,
        avgDays: 3,
        weekOverWeekThreshold: 5,
        manager: `@may.0${(idx % 9) + 1}`,
      })
      idx++
    })

    return items
  })

  const handleChange = (id: string, field: keyof AlertSetting, value: string | number) => {
    setSettings((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  const handleSave = () => {
    console.log("Saving settings:", settings)
    alert("설정이 저장되었습니다.")
  }

  const yongsanSettings = settings.filter((s) => s.center === "용산")
  const gwangjuSettings = settings.filter((s) => s.center === "광주")

  return (
    <Card className="border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-[#1e3a5f]" />
          <CardTitle className="text-lg">그룹별 알림 설정</CardTitle>
        </div>
        <Button onClick={handleSave} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
          <Save className="mr-2 h-4 w-4" />
          설정 저장
        </Button>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* 알림 조건 설명 배너 */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            <span className="font-medium">알림 조건:</span> 평균이하(일) = N일 연속 센터 평균 초과 시 | 전주대비(%p) =
            전주 대비 N%p 이상 상승 시 | 매일 오전 9시 Slack 발송 |{" "}
            <span className="text-red-600 font-medium">⚠ 2일 이상 액션 미입력 시 담당자에게 알림</span>
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#1e3a5f]">
                <TableHead className="text-white font-medium w-12 text-center">No</TableHead>
                <TableHead className="text-white font-medium min-w-[140px]">센터-그룹</TableHead>
                <TableHead className="text-white font-medium text-center w-20">태도(%)</TableHead>
                <TableHead className="text-white font-medium text-center w-20">업무(%)</TableHead>
                <TableHead className="text-white font-medium text-center w-20">전체(%)</TableHead>
                <TableHead className="text-white font-medium text-center w-24">평균이하(일)</TableHead>
                <TableHead className="text-white font-medium text-center w-24">전주대비(%p)</TableHead>
                <TableHead className="text-white font-medium w-28">@담당자</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* 용산센터 헤더 */}
              <TableRow className="bg-[#1e3a5f]">
                <TableCell colSpan={8} className="py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-400"></span>
                    <span className="text-white font-medium">용산 센터</span>
                  </div>
                </TableCell>
              </TableRow>
              {yongsanSettings.map((setting, index) => (
                <TableRow key={setting.id} className="hover:bg-slate-50">
                  <TableCell className="text-center font-medium text-slate-600">{index + 1}</TableCell>
                  <TableCell className="font-medium text-slate-800">{setting.group}</TableCell>
                  <TableCell className="text-center p-1">
                    <Input
                      type="number"
                      step="0.1"
                      value={setting.attitudeThreshold}
                      onChange={(e) => handleChange(setting.id, "attitudeThreshold", Number(e.target.value))}
                      className="w-16 h-8 text-center mx-auto bg-white border-slate-200"
                    />
                  </TableCell>
                  <TableCell className="text-center p-1">
                    <Input
                      type="number"
                      step="0.1"
                      value={setting.counselingThreshold}
                      onChange={(e) => handleChange(setting.id, "counselingThreshold", Number(e.target.value))}
                      className="w-16 h-8 text-center mx-auto bg-white border-slate-200"
                    />
                  </TableCell>
                  <TableCell className="text-center p-1">
                    <Input
                      type="number"
                      step="0.1"
                      value={setting.totalThreshold}
                      onChange={(e) => handleChange(setting.id, "totalThreshold", Number(e.target.value))}
                      className="w-16 h-8 text-center mx-auto bg-white border-slate-200"
                    />
                  </TableCell>
                  <TableCell className="text-center p-1">
                    <Input
                      type="number"
                      value={setting.avgDays}
                      onChange={(e) => handleChange(setting.id, "avgDays", Number(e.target.value))}
                      className="w-16 h-8 text-center mx-auto bg-white border-slate-200"
                    />
                  </TableCell>
                  <TableCell className="text-center p-1">
                    <Input
                      type="number"
                      value={setting.weekOverWeekThreshold}
                      onChange={(e) => handleChange(setting.id, "weekOverWeekThreshold", Number(e.target.value))}
                      className="w-16 h-8 text-center mx-auto bg-white border-slate-200"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      value={setting.manager}
                      onChange={(e) => handleChange(setting.id, "manager", e.target.value)}
                      className="w-24 h-8 bg-white border-slate-200"
                    />
                  </TableCell>
                </TableRow>
              ))}

              {/* 광주센터 헤더 */}
              <TableRow className="bg-[#1e3a5f]">
                <TableCell colSpan={8} className="py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#fee500]"></span>
                    <span className="text-white font-medium">광주 센터</span>
                  </div>
                </TableCell>
              </TableRow>
              {gwangjuSettings.map((setting, index) => (
                <TableRow key={setting.id} className="hover:bg-slate-50">
                  <TableCell className="text-center font-medium text-slate-600">
                    {yongsanSettings.length + index + 1}
                  </TableCell>
                  <TableCell className="font-medium text-slate-800">{setting.group}</TableCell>
                  <TableCell className="text-center p-1">
                    <Input
                      type="number"
                      step="0.1"
                      value={setting.attitudeThreshold}
                      onChange={(e) => handleChange(setting.id, "attitudeThreshold", Number(e.target.value))}
                      className="w-16 h-8 text-center mx-auto bg-white border-slate-200"
                    />
                  </TableCell>
                  <TableCell className="text-center p-1">
                    <Input
                      type="number"
                      step="0.1"
                      value={setting.counselingThreshold}
                      onChange={(e) => handleChange(setting.id, "counselingThreshold", Number(e.target.value))}
                      className="w-16 h-8 text-center mx-auto bg-white border-slate-200"
                    />
                  </TableCell>
                  <TableCell className="text-center p-1">
                    <Input
                      type="number"
                      step="0.1"
                      value={setting.totalThreshold}
                      onChange={(e) => handleChange(setting.id, "totalThreshold", Number(e.target.value))}
                      className="w-16 h-8 text-center mx-auto bg-white border-slate-200"
                    />
                  </TableCell>
                  <TableCell className="text-center p-1">
                    <Input
                      type="number"
                      value={setting.avgDays}
                      onChange={(e) => handleChange(setting.id, "avgDays", Number(e.target.value))}
                      className="w-16 h-8 text-center mx-auto bg-white border-slate-200"
                    />
                  </TableCell>
                  <TableCell className="text-center p-1">
                    <Input
                      type="number"
                      value={setting.weekOverWeekThreshold}
                      onChange={(e) => handleChange(setting.id, "weekOverWeekThreshold", Number(e.target.value))}
                      className="w-16 h-8 text-center mx-auto bg-white border-slate-200"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      value={setting.manager}
                      onChange={(e) => handleChange(setting.id, "manager", e.target.value)}
                      className="w-24 h-8 bg-white border-slate-200"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
