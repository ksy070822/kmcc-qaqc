"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ArrowRight, User } from "lucide-react"
import { cn } from "@/lib/utils"

interface WatchAgent {
  id: string
  name: string
  center: string
  group: string
  errorRate: number
  trend: number
  mainIssue: string
}

interface WatchlistPreviewProps {
  agents: WatchAgent[]
  onViewAll: () => void
}

export function WatchlistPreview({ agents, onViewAll }: WatchlistPreviewProps) {
  return (
    <Card className="border-2 border-amber-400 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            유의상담사
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAll}
            className="text-primary hover:text-primary hover:bg-primary/10"
          >
            전체보기
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {agents.slice(0, 5).map((agent) => (
            <div
              key={agent.id}
              className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{agent.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {agent.center} {agent.group}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{agent.mainIssue}</p>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={cn("font-mono text-lg font-bold", agent.errorRate > 7 ? "text-red-600" : "text-amber-600")}
                >
                  {agent.errorRate.toFixed(1)}%
                </div>
                <div className={cn("text-xs font-medium", agent.trend > 0 ? "text-red-600" : "text-emerald-600")}>
                  {agent.trend > 0 ? "+" : ""}
                  {agent.trend.toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
