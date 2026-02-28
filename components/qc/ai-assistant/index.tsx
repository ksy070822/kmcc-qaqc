"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AgentSelector } from "./agent-selector"
import { ChatInterface, ChatInterfaceRef } from "./chat-interface"
import { Bot, Sparkles, PanelLeftClose, PanelLeftOpen } from "lucide-react"

export function AIAssistant() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>()
  const [selectedGroup, setSelectedGroup] = useState<
    | {
        center?: string
        service?: string
        channel?: string
      }
    | undefined
  >()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const chatInterfaceRef = useRef<ChatInterfaceRef | null>(null)
  const prevSelectionRef = useRef<{ agentId?: string; group?: { service?: string; channel?: string } }>({})

  // 선택이 변경되면 자동 분석 트리거
  useEffect(() => {
    const currentSelection = { agentId: selectedAgentId, group: selectedGroup }
    const prevSelection = prevSelectionRef.current

    // 선택이 새로 되었거나 변경된 경우
    if (
      (selectedAgentId && selectedAgentId !== prevSelection.agentId) ||
      (selectedGroup && JSON.stringify(selectedGroup) !== JSON.stringify(prevSelection.group))
    ) {
      // 이전에 선택이 없었거나 다른 선택이었던 경우에만 자동 분석
      if (
        (!prevSelection.agentId && !prevSelection.group) ||
        selectedAgentId !== prevSelection.agentId ||
        JSON.stringify(selectedGroup) !== JSON.stringify(prevSelection.group)
      ) {
        // 약간의 딜레이 후 자동 분석 실행
        const timer = setTimeout(() => {
          chatInterfaceRef.current?.triggerAutoAnalysis()
        }, 500)
        
        prevSelectionRef.current = currentSelection
        return () => clearTimeout(timer)
      }
    }

    prevSelectionRef.current = currentSelection
  }, [selectedAgentId, selectedGroup])

  const handleAgentSelect = (agentId: string | undefined) => {
    setSelectedAgentId(agentId)
    if (!agentId) {
      setSelectedGroup(undefined)
      // 선택 초기화 시 prevSelectionRef도 초기화하여 다시 선택 시 자동 분석이 트리거되도록 함
      prevSelectionRef.current = {}
    }
  }

  const handleGroupSelect = (group: { center?: string; service?: string; channel?: string } | undefined) => {
    setSelectedGroup(group)
    if (group) {
      setSelectedAgentId(undefined)
    } else {
      // 선택 초기화 시 prevSelectionRef도 초기화하여 다시 선택 시 자동 분석이 트리거되도록 함
      prevSelectionRef.current = {}
    }
  }

  // 선택 초기화 핸들러 추가
  const handleClearSelection = () => {
    setSelectedAgentId(undefined)
    setSelectedGroup(undefined)
    // 선택 초기화 시 prevSelectionRef도 초기화하여 다시 선택 시 자동 분석이 트리거되도록 함
    prevSelectionRef.current = {}
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI 어시스턴트</h1>
            <p className="text-sm text-muted-foreground">
              상담사나 그룹에 대한 분석 및 코칭 제안을 받아보세요
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="shrink-0"
          title={sidebarOpen ? "사이드바 숨기기" : "사이드바 보이기"}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-5 w-5" />
          ) : (
            <PanelLeftOpen className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="flex gap-6 relative">
        {/* 왼쪽: 선택 패널 */}
        <div
          className={`
            space-y-4 transition-all duration-300 ease-in-out
            ${sidebarOpen ? "w-[350px] opacity-100" : "w-0 opacity-0 overflow-hidden"}
          `}
        >
          <div className="space-y-4">
            <AgentSelector
              selectedAgentId={selectedAgentId}
              selectedGroup={selectedGroup}
              onAgentSelect={handleAgentSelect}
              onGroupSelect={handleGroupSelect}
              onClear={handleClearSelection}
            />

            {/* 안내 카드 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  사용 방법
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <p>1. 상담사 또는 그룹을 선택하세요</p>
                <p>2. 자동으로 종합 분석이 시작됩니다</p>
                <p>3. 추가 질문을 입력할 수 있습니다</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 오른쪽: 채팅 인터페이스 */}
        <div className="flex-1 min-w-0 relative">
          {/* 사이드바가 숨겨졌을 때 선택 정보 표시 */}
          {!sidebarOpen && (selectedAgentId || selectedGroup) && (
            <div className="absolute top-0 left-0 right-0 z-10 bg-background/95 backdrop-blur-sm border-b p-2 flex items-center justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-2 text-sm">
                {selectedAgentId && (
                  <span className="font-medium text-foreground">
                    상담사: {selectedAgentId}
                  </span>
                )}
                {selectedGroup && (
                  <span className="font-medium text-foreground">
                    {selectedGroup.center} {selectedGroup.service}/{selectedGroup.channel}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(true)}
                className="text-xs"
              >
                <PanelLeftOpen className="h-4 w-4 mr-1" />
                사이드바 열기
              </Button>
            </div>
          )}
          <div className={!sidebarOpen && (selectedAgentId || selectedGroup) ? "pt-12" : ""}>
            <ChatInterface 
              ref={chatInterfaceRef}
              agentId={selectedAgentId} 
              group={selectedGroup} 
            />
          </div>
        </div>
      </div>
    </div>
  )
}
