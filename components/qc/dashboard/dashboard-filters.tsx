"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon, Search } from "lucide-react"
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
  
  // 센터에 따른 서비스 목록
  const getServices = () => {
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
      {/* 날짜 선택기 */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">기간</span>
        <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[140px] justify-start text-left font-normal bg-white",
                !startDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
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
                "w-[140px] justify-start text-left font-normal bg-white",
                !endDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
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
