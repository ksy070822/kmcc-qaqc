"use client"

import { cn } from "@/lib/utils"
import { LayoutDashboard, Users, AlertTriangle, FileText, Settings, Building2, ChevronLeft, Bell, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface SidebarProps {
  currentTab: string
  onTabChange: (tab: string) => void
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  alertCount?: number
}

const navItems = [
  { id: "dashboard", label: "대시보드", icon: LayoutDashboard },
  { id: "predictions", label: "예측", icon: TrendingUp },
  { id: "agents", label: "상담사 분석", icon: Users },
  { id: "focus", label: "집중관리", icon: AlertTriangle },
  { id: "reports", label: "분석 리포트", icon: FileText },
  { id: "settings", label: "설정", icon: Settings },
]

export function Sidebar({ currentTab, onTabChange, collapsed, onCollapsedChange, alertCount = 0 }: SidebarProps) {
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-kakao">
                <Building2 className="h-5 w-5 text-navy" />
              </div>
              <span className="font-semibold text-sidebar-foreground">QC Management</span>
            </div>
          )}
          {collapsed && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-kakao">
              <Building2 className="h-5 w-5 text-navy" />
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCollapsedChange(!collapsed)}
              className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
            </Button>
          )}
        </div>

        {/* Collapse button for collapsed state */}
        {collapsed && (
          <div className="flex justify-center py-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCollapsedChange(!collapsed)}
              className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <ChevronLeft className="h-4 w-4 rotate-180" />
            </Button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentTab === item.id
            const showBadge = item.id === "focus" && alertCount > 0

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-kakao text-navy"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-navy")} />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {showBadge && (
                      <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                        {alertCount}
                      </Badge>
                    )}
                  </>
                )}
                {collapsed && showBadge && (
                  <span className="absolute right-2 top-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4">
          {!collapsed && (
            <div className="flex items-center gap-2 text-xs text-sidebar-foreground/70">
              <Bell className="h-4 w-4" />
              <span>알림 {alertCount}건</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
