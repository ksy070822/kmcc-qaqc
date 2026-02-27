"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import Image from "next/image"
import { NoticeBell } from "@/components/mypage/notice-bell"
import { useUnreadNoticeCount } from "@/hooks/use-notices"
import {
  ChevronLeft,
  LayoutDashboard,
  CalendarDays,
  CalendarRange,
  MessageSquare,
  Megaphone,
  LogOut,
  Loader2,
  User,
  Users,
} from "lucide-react"

const mypageNavItems = [
  { id: "/mypage/notices", label: "공지사항", icon: Megaphone },
  { id: "/mypage", label: "통합 현황", icon: LayoutDashboard, exact: true },
  { id: "/mypage/weekly", label: "주간 리포트", icon: CalendarDays },
  { id: "/mypage/monthly", label: "월간 리포트", icon: CalendarRange },
  { id: "/mypage/coaching", label: "코칭 피드백", icon: MessageSquare },
]

const adminNavItems = [
  { id: "/mypage/agents", label: "상담사 관리", icon: Users },
]

export default function MypageLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading, logout } = useAuth()
  const { count: unreadCount } = useUnreadNoticeCount(user?.userId ?? null, user?.center ?? null)
  const [collapsed, setCollapsed] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#1e3a5f]" />
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
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/mypage")}>
                <Image src="/kakaot_logo1.png" alt="카카오T" width={32} height={32} className="rounded-lg" />
                <span className="font-bold text-sidebar-foreground text-base whitespace-nowrap">KMCC 통합 관리 시스템</span>
              </div>
            )}
            {collapsed && (
              <Image src="/kakaot_logo1.png" alt="카카오T" width={32} height={32} className="rounded-lg cursor-pointer" onClick={() => router.push("/mypage")} />
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
            {mypageNavItems.map((item) => {
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

            {/* 관리자용 메뉴 */}
            {user && (user.role === "hq_admin" || user.role === "manager") && (
              <>
                {!collapsed && (
                  <div className="pt-3 pb-1 px-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">관리</span>
                  </div>
                )}
                {adminNavItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname.startsWith(item.id)
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
              </>
            )}
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
          <div className="flex items-center gap-2 flex-wrap">
            {user && (
              <>
                {user.center && (
                  <Badge variant="outline" className="text-[11px] px-2 py-0.5 bg-blue-50 border-blue-200 text-blue-700">
                    {user.center}
                  </Badge>
                )}
                {user.service && (
                  <Badge variant="outline" className="text-[11px] px-2 py-0.5 bg-slate-50 border-slate-200 text-slate-600">
                    {user.service}
                  </Badge>
                )}
                {user.channel && (
                  <Badge variant="outline" className="text-[11px] px-2 py-0.5 bg-emerald-50 border-emerald-200 text-emerald-700">
                    {user.channel === "유선" ? "유선" : user.channel === "채팅" ? "채팅" : user.channel}
                  </Badge>
                )}
                {user.workHours && (
                  <Badge variant="outline" className="text-[11px] px-2 py-0.5 bg-amber-50 border-amber-200 text-amber-700">
                    {user.workHours}
                  </Badge>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={() => router.push("/mypage/notices")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-xs text-red-600 font-medium hover:bg-red-100 transition-colors animate-pulse"
              >
                <Megaphone className="h-3.5 w-3.5" />
                새로운 공지를 확인해주세요
              </button>
            )}
            <NoticeBell agentId={user?.userId ?? null} center={user?.center ?? null} />
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
