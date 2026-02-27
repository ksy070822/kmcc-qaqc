"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import Image from "next/image"
import {
  ChevronLeft,
  LayoutDashboard,
  ClipboardList,
  UserX,
  Users,
  Megaphone,
  LogOut,
  Loader2,
  User,
} from "lucide-react"

const managerNavItems = [
  { id: "/manager", label: "품질 대시보드", icon: LayoutDashboard, exact: true },
  { id: "/manager/weekly-report", label: "주간보고 작성", icon: ClipboardList },
  { id: "/manager/underperforming", label: "부진상담사 관리", icon: UserX },
  { id: "/manager/agents", label: "상담사 목록", icon: Users },
  { id: "/manager/notices", label: "공지/교육 관리", icon: Megaphone },
]

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#2c6edb]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 사이드바 */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border bg-sidebar transition-all duration-300",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className="flex h-full flex-col">
          {/* 헤더 */}
          <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
            {!collapsed && (
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/manager")}>
                <Image src="/kakaot_logo1.png" alt="Komi" width={32} height={32} className="rounded-lg" />
                <span className="font-bold text-sidebar-foreground text-sm whitespace-nowrap">KMCC 통합 관리 시스템</span>
              </div>
            )}
            {collapsed && (
              <Image src="/kakaot_logo1.png" alt="Komi" width={32} height={32} className="rounded-lg cursor-pointer" onClick={() => router.push("/manager")} />
            )}
            {!collapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(!collapsed)}
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
                onClick={() => setCollapsed(!collapsed)}
                className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <ChevronLeft className="h-4 w-4 rotate-180" />
              </Button>
            </div>
          )}

          {/* 사용자 정보 */}
          {!collapsed && user && (
            <div className="px-4 py-3 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent">
                  <User className="h-4 w-4 text-sidebar-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-sidebar-foreground truncate">{user.userId} / {user.userName}</div>
                  <div className="text-xs text-sidebar-foreground/60 truncate">
                    {user.center} {user.service && `/ ${user.service}`}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 네비게이션 */}
          <nav className="flex-1 space-y-1 p-2">
            {managerNavItems.map((item) => {
              const Icon = item.icon
              const isActive = item.exact
                ? pathname === item.id
                : pathname.startsWith(item.id)
              return (
                <button
                  key={item.id}
                  onClick={() => router.push(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[#2c6edb] text-white"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    collapsed && "justify-center px-2",
                  )}
                >
                  <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-white")} />
                  {!collapsed && <span>{item.label}</span>}
                </button>
              )
            })}
          </nav>

          {/* 하단: 로그아웃 */}
          <div className="border-t border-sidebar-border p-2">
            <button
              onClick={logout}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors",
                collapsed && "justify-center px-2",
              )}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {!collapsed && <span>로그아웃</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <div className={cn("transition-all duration-300", collapsed ? "ml-16" : "ml-60")}>
        {/* 상단 헤더 */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-[#1e3a5f]/5 border-[#1e3a5f]/20 text-[#1e3a5f]">
              관리자
            </Badge>
            {user && (
              <span className="text-sm text-slate-500">
                {user.center} {user.service && `- ${user.service}`}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400">
            KMCC 통합 관리 시스템 (Komi)
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
