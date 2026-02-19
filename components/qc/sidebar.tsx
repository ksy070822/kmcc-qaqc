"use client"

import { cn } from "@/lib/utils"
import { LayoutDashboard, Users, AlertTriangle, FileText, Settings, ChevronLeft, TrendingUp, Bot, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { clearAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"

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
  { id: "ai-assistant", label: "AI 어시스턴트", icon: Bot },
  { id: "focus", label: "집중관리", icon: AlertTriangle },
  { id: "reports", label: "분석 리포트", icon: FileText },
  { id: "settings", label: "설정", icon: Settings },
]

export function Sidebar({ currentTab, onTabChange, collapsed, onCollapsedChange, alertCount = 0 }: SidebarProps) {
  const router = useRouter()

  const handleLogout = () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      clearAuth()
      router.push("/login")
    }
  }

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
              <Image src="/kakaot_logo1.png" alt="카카오T" width={32} height={32} className="rounded-lg" />
              <span className="font-bold text-sidebar-foreground text-base whitespace-nowrap">상담품질 관리 시스템</span>
            </div>
          )}
          {collapsed && (
            <Image src="/kakaot_logo1.png" alt="카카오T" width={32} height={32} className="rounded-lg" />
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
                    ? "bg-[#2c6edb] text-white"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-white")} />
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
        <div className="border-t border-sidebar-border p-2">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>로그아웃</span>}
          </button>
        </div>
      </div>
    </aside>
  )
}
