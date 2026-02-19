"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, User, Users, X } from "lucide-react"
import { useAgents } from "@/hooks/use-agents"
import { serviceGroups, channelTypes } from "@/lib/constants"

interface AgentSelectorProps {
  selectedAgentId?: string
  selectedGroup?: {
    center?: string
    service?: string
    channel?: string
  }
  onAgentSelect: (agentId: string | undefined) => void
  onGroupSelect: (group: { center?: string; service?: string; channel?: string } | undefined) => void
  onClear?: () => void
}

export function AgentSelector({
  selectedAgentId,
  selectedGroup,
  onAgentSelect,
  onGroupSelect,
  onClear,
}: AgentSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCenter, setSelectedCenter] = useState("all")
  const [selectedService, setSelectedService] = useState("all")
  const [selectedChannel, setSelectedChannel] = useState("all")
  const [mode, setMode] = useState<"agent" | "group">("agent")

  const { data: agents, loading, error } = useAgents({
    center: selectedCenter !== "all" ? selectedCenter : undefined,
    service: selectedService !== "all" ? selectedService : undefined,
    channel: selectedChannel !== "all" ? selectedChannel : undefined,
  })

  const filteredAgents = (agents || []).filter((agent) =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const availableServices =
    selectedCenter === "all"
      ? [...new Set([...serviceGroups["용산"], ...serviceGroups["광주"]])]
      : selectedCenter === "용산"
        ? serviceGroups["용산"]
        : serviceGroups["광주"]

  const selectedAgent = agents?.find((a) => a.id === selectedAgentId)

  const handleGroupApply = () => {
    if (selectedCenter !== "all" && selectedService !== "all" && selectedChannel !== "all") {
      onGroupSelect({
        center: selectedCenter,
        service: selectedService,
        channel: selectedChannel,
      })
      onAgentSelect(undefined)
      setMode("group")
    }
  }

  const handleClear = () => {
    onAgentSelect(undefined)
    onGroupSelect(undefined)
    setSearchTerm("")
    setSelectedCenter("all")
    setSelectedService("all")
    setSelectedChannel("all")
    setMode("agent")
    // 부모 컴포넌트의 clear 핸들러도 호출
    if (onClear) {
      onClear()
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">분석 대상 선택</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 모드 선택 */}
        <div className="flex gap-2">
          <Button
            variant={mode === "agent" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setMode("agent")
              onGroupSelect(undefined)
            }}
            className="flex items-center gap-2"
          >
            <User className="h-4 w-4" />
            상담사
          </Button>
          <Button
            variant={mode === "group" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setMode("group")
              onAgentSelect(undefined)
            }}
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            그룹
          </Button>
        </div>

        {mode === "agent" ? (
          <>
            {/* 상담사 검색 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="상담사 이름/ID 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* 필터 */}
            <div className="flex gap-2">
              <Select value={selectedCenter} onValueChange={(v) => {
                setSelectedCenter(v)
                setSelectedService("all")
              }}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="센터" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="용산">용산</SelectItem>
                  <SelectItem value="광주">광주</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="서비스" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {availableServices.map((svc) => (
                    <SelectItem key={svc} value={svc}>
                      {svc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="채널" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {channelTypes.map((ch) => (
                    <SelectItem key={ch} value={ch}>
                      {ch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 선택된 상담사 표시 */}
            {selectedAgent && (
              <div className="flex items-center justify-between rounded-md border p-3 bg-muted/50">
                <div>
                  <div className="font-medium">{selectedAgent.name} / {selectedAgent.id}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedAgent.center} {selectedAgent.service}/{selectedAgent.channel}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onAgentSelect(undefined)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* 상담사 목록 */}
            {!selectedAgent && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {loading ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">로딩 중...</div>
                ) : error ? (
                  <div className="text-center py-4 text-sm text-red-500">
                    {error}
                  </div>
                ) : !agents || agents.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    상담사 데이터를 불러올 수 없습니다.
                  </div>
                ) : filteredAgents.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    검색 결과가 없습니다.
                  </div>
                ) : (
                  filteredAgents.slice(0, 10).map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => onAgentSelect(agent.id)}
                      className="w-full text-left rounded-md border p-2 hover:bg-muted transition-colors"
                    >
                      <div className="font-medium">{agent.name} / {agent.id}</div>
                      <div className="text-xs text-muted-foreground">
                        {agent.center} {agent.service}/{agent.channel} · 오류율: {agent.overallErrorRate.toFixed(2)}%
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* 그룹 선택 */}
            <div className="space-y-2">
              <Select 
                value={selectedCenter === "all" ? undefined : selectedCenter} 
                onValueChange={(v) => {
                  setSelectedCenter(v)
                  setSelectedService("all")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="센터 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="용산">용산</SelectItem>
                  <SelectItem value="광주">광주</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger>
                  <SelectValue placeholder="서비스 선택" />
                </SelectTrigger>
                <SelectContent>
                  {availableServices.map((svc) => (
                    <SelectItem key={svc} value={svc}>
                      {svc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger>
                  <SelectValue placeholder="채널 선택" />
                </SelectTrigger>
                <SelectContent>
                  {channelTypes.map((ch) => (
                    <SelectItem key={ch} value={ch}>
                      {ch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={handleGroupApply}
                disabled={!selectedCenter || selectedCenter === "all" || !selectedService || selectedService === "all" || !selectedChannel || selectedChannel === "all"}
                className="w-full"
              >
                그룹 선택
              </Button>
            </div>

            {/* 선택된 그룹 표시 */}
            {selectedGroup?.center && selectedGroup?.service && selectedGroup?.channel && (
              <div className="flex items-center justify-between rounded-md border p-3 bg-muted/50">
                <div>
                  <div className="font-medium">그룹</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedGroup.center} {selectedGroup.service}/{selectedGroup.channel}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={handleClear}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}

        {/* 초기화 버튼 */}
        {(selectedAgentId || selectedGroup) && (
          <Button variant="outline" onClick={handleClear} className="w-full">
            선택 초기화
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
