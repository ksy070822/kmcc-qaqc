"use client"

import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { serviceGroups, channelTypes, tenureCategories } from "@/lib/constants"

interface DashboardFiltersProps {
  selectedCenter: string
  setSelectedCenter: (value: string) => void
  selectedService: string
  setSelectedService: (value: string) => void
  selectedChannel: string
  setSelectedChannel: (value: string) => void
  selectedTenure: string
  setSelectedTenure: (value: string) => void
  startDate?: string
  endDate?: string
  onDateChange?: (startDate: string, endDate: string) => void
  onSearch?: () => void
  /** 커스텀 서비스 목록 (CSAT 등 QC와 다른 서비스 체계일 때) */
  customServices?: readonly string[]
}

export function DashboardFilters({
  selectedCenter,
  setSelectedCenter,
  selectedService,
  setSelectedService,
  selectedChannel,
  setSelectedChannel,
  selectedTenure,
  setSelectedTenure,
  startDate: propStartDate,
  endDate: propEndDate,
  onDateChange,
  onSearch,
  customServices,
}: DashboardFiltersProps) {
  // 기본값: 이번 주 목~수 (목요일 시작, 수요일 종료)
  const getThursdayToWednesday = () => {
    const today = new Date()
    const dayOfWeek = today.getDay() // 0=Sun, 1=Mon, ..., 4=Thu, 6=Sat
    // 가장 최근 목요일 찾기
    const daysBack = (dayOfWeek - 4 + 7) % 7
    const thursday = new Date(today)
    thursday.setDate(today.getDate() - daysBack)
    // 다음 수요일
    const wednesday = new Date(thursday)
    wednesday.setDate(thursday.getDate() + 6)
    return { thursday, wednesday }
  }
  const { thursday: defaultStart, wednesday: defaultEnd } = getThursdayToWednesday()
  const defaultDate = defaultStart.toISOString().split('T')[0]

  const [startDate, setStartDate] = useState<Date | undefined>(
    propStartDate ? new Date(propStartDate) : defaultStart
  )
  const [endDate, setEndDate] = useState<Date | undefined>(
    propEndDate ? new Date(propEndDate) : defaultEnd
  )
  const [startDateOpen, setStartDateOpen] = useState(false)
  const [endDateOpen, setEndDateOpen] = useState(false)

  // QualityDashboard 주차 선택 시 props 변경 → 필터 캘린더 state 동기화
  useEffect(() => {
    if (propStartDate && propEndDate) {
      const newStart = new Date(propStartDate)
      const newEnd = new Date(propEndDate)
      if (!isNaN(newStart.getTime()) && !isNaN(newEnd.getTime())) {
        setStartDate(newStart)
        setEndDate(newEnd)
      }
    }
  }, [propStartDate, propEndDate])

  // 센터에 따른 서비스 목록
  const getServices = () => {
    if (customServices) return [...customServices]
    if (selectedCenter === "all") {
      return [...new Set([...serviceGroups["용산"], ...serviceGroups["광주"]])]
    }
    return serviceGroups[selectedCenter as "용산" | "광주"] || []
  }

  // 센터 변경 시 서비스 초기화
  const handleCenterChange = (value: string) => {
    setSelectedCenter(value)
    setSelectedService("all")
  }

  // 날짜 변경 핸들러
  const handleStartDateSelect = (date: Date | undefined) => {
    setStartDate(date)
    setStartDateOpen(false)
    if (date && onDateChange) {
      const startStr = date.toISOString().split('T')[0]
      const endStr = endDate ? endDate.toISOString().split('T')[0] : startStr
      onDateChange(startStr, endStr)
    }
  }

  const handleEndDateSelect = (date: Date | undefined) => {
    setEndDate(date)
    setEndDateOpen(false)
    if (date && onDateChange) {
      const startStr = startDate ? startDate.toISOString().split('T')[0] : defaultDate
      const endStr = date.toISOString().split('T')[0]
      onDateChange(startStr, endStr)
    }
  }

  // 월 단위 날짜 설정 (1일~말일)
  const setMonthRange = (year: number, month: number) => {
    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month + 1, 0)
    setStartDate(monthStart)
    setEndDate(monthEnd)
    if (onDateChange) {
      onDateChange(
        monthStart.toISOString().split('T')[0],
        monthEnd.toISOString().split('T')[0]
      )
    }
  }

  // 전월 버튼
  const handlePrevMonth = () => {
    const base = startDate || new Date()
    setMonthRange(base.getFullYear(), base.getMonth() - 1)
  }

  // 다음월 버튼
  const handleNextMonth = () => {
    const base = startDate || new Date()
    setMonthRange(base.getFullYear(), base.getMonth() + 1)
  }

  // 당월 버튼
  const handleCurrentMonth = () => {
    const now = new Date()
    setMonthRange(now.getFullYear(), now.getMonth())
  }

  // 전월 버튼 (직전 월 전체)
  const handleLastMonth = () => {
    const now = new Date()
    setMonthRange(now.getFullYear(), now.getMonth() - 1)
  }

  // 조회 버튼 클릭 - 날짜 범위 업데이트 후 데이터 갱신
  const handleSearch = () => {
    const startStr = startDate ? startDate.toISOString().split('T')[0] : defaultDate
    const endStr = endDate ? endDate.toISOString().split('T')[0] : defaultDate

    // 날짜 범위를 상위로 전달 → useEffect가 fetchData를 자동 트리거
    if (onDateChange) {
      onDateChange(startStr, endStr)
    }

    // 날짜가 이미 같은 경우(변경 없으면 useEffect 미트리거)에 대비해 명시적 refetch
    // setTimeout으로 state 반영 후 호출
    if (onSearch) {
      setTimeout(() => onSearch(), 0)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-lg border">
      {/* 기간 선택 */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">기간</span>
        {/* 월 네비게이션 */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-white"
            onClick={handlePrevMonth}
            title="이전 월"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs bg-white"
            onClick={handleLastMonth}
          >
            전월
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs bg-white"
            onClick={handleCurrentMonth}
          >
            당월
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-white"
            onClick={handleNextMonth}
            title="다음 월"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* 캘린더 직접 선택 */}
        <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[130px] h-8 justify-start text-left font-normal bg-white text-xs",
                !startDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-1 h-3 w-3" />
              {startDate ? format(startDate, "yyyy-MM-dd", { locale: ko }) : "시작일"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={handleStartDateSelect}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <span className="text-sm text-gray-500">~</span>
        <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[130px] h-8 justify-start text-left font-normal bg-white text-xs",
                !endDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-1 h-3 w-3" />
              {endDate ? format(endDate, "yyyy-MM-dd", { locale: ko }) : "종료일"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={handleEndDateSelect}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">센터</span>
        <Select value={selectedCenter} onValueChange={handleCenterChange}>
          <SelectTrigger className="w-[100px] bg-white">
            <SelectValue placeholder="전체" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="용산">용산</SelectItem>
            <SelectItem value="광주">광주</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">서비스</span>
        <Select value={selectedService} onValueChange={setSelectedService}>
          <SelectTrigger className="w-[130px] bg-white">
            <SelectValue placeholder="전체" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {getServices().map((service) => (
              <SelectItem key={service} value={service}>
                {service}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">채널</span>
        <Select value={selectedChannel} onValueChange={setSelectedChannel}>
          <SelectTrigger className="w-[100px] bg-white">
            <SelectValue placeholder="전체" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {channelTypes.map((channel) => (
              <SelectItem key={channel} value={channel}>
                {channel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">근속기간</span>
        <Select value={selectedTenure} onValueChange={setSelectedTenure}>
          <SelectTrigger className="w-[130px] bg-white">
            <SelectValue placeholder="전체" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {tenureCategories.map((tenure) => (
              <SelectItem key={tenure} value={tenure}>
                {tenure}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 조회 버튼 - 가장 우측에 배치 */}
      <div className="ml-auto">
        <Button
          onClick={handleSearch}
          size="sm"
          className="bg-[#2c6edb] text-white hover:bg-[#202237] min-w-[100px]"
        >
          <Search className="mr-2 h-4 w-4" />
          Q 조회
        </Button>
      </div>
    </div>
  )
}
