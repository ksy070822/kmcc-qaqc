"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { tenureCategories, serviceGroups, channelTypes } from "@/lib/mock-data"

interface AgentFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  selectedCenter: string
  onCenterChange: (value: string) => void
  selectedChannel: string
  onChannelChange: (value: string) => void
  selectedServiceGroup: string
  onServiceGroupChange: (value: string) => void
  selectedTenure: string
  onTenureChange: (value: string) => void
}

export function AgentFilters({
  search,
  onSearchChange,
  selectedCenter,
  onCenterChange,
  selectedChannel,
  onChannelChange,
  selectedServiceGroup,
  onServiceGroupChange,
  selectedTenure,
  onTenureChange,
}: AgentFiltersProps) {
  const availableServiceGroups =
    selectedCenter === "all"
      ? [...new Set([...serviceGroups["용산"], ...serviceGroups["광주"]])]
      : selectedCenter === "용산"
        ? serviceGroups["용산"]
        : serviceGroups["광주"]

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="상담사 검색..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-white border-slate-200"
        />
      </div>

      <Select
        value={selectedCenter}
        onValueChange={(v) => {
          onCenterChange(v)
          // 센터 변경 시 서비스그룹 초기화
          onServiceGroupChange("all")
        }}
      >
        <SelectTrigger className="w-28 bg-white border-slate-200">
          <SelectValue placeholder="센터" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 센터</SelectItem>
          <SelectItem value="용산">용산</SelectItem>
          <SelectItem value="광주">광주</SelectItem>
        </SelectContent>
      </Select>

      <Select value={selectedServiceGroup} onValueChange={onServiceGroupChange}>
        <SelectTrigger className="w-36 bg-white border-slate-200">
          <SelectValue placeholder="서비스" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 서비스</SelectItem>
          {availableServiceGroups.map((sg) => (
            <SelectItem key={sg} value={sg}>
              {sg}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedChannel} onValueChange={onChannelChange}>
        <SelectTrigger className="w-28 bg-white border-slate-200">
          <SelectValue placeholder="채널" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 채널</SelectItem>
          {channelTypes.map((channel) => (
            <SelectItem key={channel} value={channel}>
              {channel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedTenure} onValueChange={onTenureChange}>
        <SelectTrigger className="w-32 bg-white border-slate-200">
          <SelectValue placeholder="근속기간" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 기간</SelectItem>
          {tenureCategories.map((tenure) => (
            <SelectItem key={tenure} value={tenure}>
              {tenure}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
