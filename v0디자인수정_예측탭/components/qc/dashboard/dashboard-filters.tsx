"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { serviceGroups, channelTypes, tenureCategories } from "@/lib/mock-data"

interface DashboardFiltersProps {
  selectedCenter: string
  setSelectedCenter: (value: string) => void
  selectedService: string
  setSelectedService: (value: string) => void
  selectedChannel: string
  setSelectedChannel: (value: string) => void
  selectedTenure: string
  setSelectedTenure: (value: string) => void
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
}: DashboardFiltersProps) {
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

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-lg border">
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
    </div>
  )
}
