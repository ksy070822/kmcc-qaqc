"use client"

import { useState, useEffect } from "react"
import { Calendar, RefreshCw, Search, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

interface HeaderProps {
  selectedDate: string
  onDateChange: (date: string) => void
  onRefresh: () => void
  onSearch: () => void
  lastUpdated: string
  alertCount?: number
}

export function Header({ selectedDate, onDateChange, onRefresh, onSearch, lastUpdated, alertCount = 0 }: HeaderProps) {
  const [today, setToday] = useState("")
  const [yesterday, setYesterday] = useState("")
  const [dates, setDates] = useState<string[]>([])

  // 클라이언트에서만 날짜 계산 (hydration 오류 방지)
  useEffect(() => {
    const todayDate = new Date().toISOString().split("T")[0]
    const yesterdayDate = new Date()
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterdayStr = yesterdayDate.toISOString().split("T")[0]

    setToday(todayDate)
    setYesterday(yesterdayStr)
    setDates(Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - i)
      return date.toISOString().split("T")[0]
    }))
  }, [])

  const getDateLabel = (date: string) => {
    if (date === today) return `오늘 (${date})`
    if (date === yesterday) return `전일 (${date})`
    return date
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Select value={selectedDate} onValueChange={onDateChange}>
          <SelectTrigger className="w-44 border-border bg-background">
            <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="날짜 선택" />
          </SelectTrigger>
          <SelectContent>
            {dates.length > 0 ? dates.map((date) => (
              <SelectItem key={date} value={date}>
                {getDateLabel(date)}
              </SelectItem>
            )) : (
              <SelectItem value={selectedDate}>{selectedDate}</SelectItem>
            )}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={onSearch} variant="default" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Search className="mr-2 h-4 w-4" />
          조회
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {alertCount > 0 && (
            <Badge variant="destructive" className="absolute -top-2 -right-2 h-4 min-w-4 px-1 text-[10px] leading-none">
              {alertCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>마지막 업데이트:</span>
          <Badge variant="outline" className="font-mono text-foreground">
            {lastUpdated || "--:--:--"}
          </Badge>
        </div>
        <Button size="sm" onClick={onRefresh} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          새로고침
        </Button>
      </div>
    </header>
  )
}
