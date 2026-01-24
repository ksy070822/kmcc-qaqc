"use client"

import { Calendar, RefreshCw, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

interface HeaderProps {
  selectedDate: string
  onDateChange: (date: string) => void
  onRefresh: () => void
  onSearch: () => void
  lastUpdated: string
}

export function Header({ selectedDate, onDateChange, onRefresh, onSearch, lastUpdated }: HeaderProps) {
  const today = new Date().toISOString().split("T")[0]
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split("T")[0]

  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - i)
    return date.toISOString().split("T")[0]
  })

  const getDateLabel = (date: string) => {
    if (date === today) return `오늘 (${date})`
    if (date === yesterdayStr) return `전일 (${date})`
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
            {dates.map((date) => (
              <SelectItem key={date} value={date}>
                {getDateLabel(date)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={onSearch} variant="default" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Search className="mr-2 h-4 w-4" />
          조회
        </Button>
      </div>

      <div className="flex items-center gap-4">
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
