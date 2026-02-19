"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import {
  GraduationCap,
  ChevronLeft,
  LayoutDashboard,
  Users,
  BarChart3,
  Target,
  FileText,
  LogOut,
  Loader2,
  User,
} from "lucide-react"

const instructorNavItems = [
  { id: "/instructor", label: "센터 현황", icon: LayoutDashboard, exact: true },
  { id: "/instructor/agents", label: "상담사 분석", icon: Users },
  { id: "/instructor/watchlist", label: "집중관리 대상", icon: Target },
  { id: "/instructor/reports", label: "리포트", icon: FileText },
]

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#7c3aed]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 사이드바 */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-slate-200 bg-white transition-all duration-300",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className="flex h-full flex-col">
          {/* 헤더 */}
          <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
            {!collapsed && (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7c3aed]">
                  <GraduationCap className="h-5 w-5 text-white" />
                </div>
                <span className="font-semibold text-slate-900 text-sm">카카오T QC</span>
              </div>
            )}
            {collapsed && (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7c3aed]">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8 text-slate-500 hover:bg-slate-100"
            >
              <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
            </Button>
          </div>

          {/* 사용자 정보 */}
          {!collapsed && user && (
            <div className="px-4 py-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-50">
                  <User className="h-4 w-4 text-[#7c3aed]" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{user.userName}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {user.center ? `${user.center} 센터` : "전체 센터"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 네비게이션 */}
          <nav className="flex-1 space-y-1 p-2">
            {instructorNavItems.map((item) => {
              const Icon = item.icon
              const isActive = item.exact
                ? pathname === item.id
                : pathname.startsWith(item.id)
              return (
                <button
                  key={item.id}
                  onClick={() => router.push(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-[#7c3aed] text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    collapsed && "justify-center px-2",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </button>
              )
            })}
          </nav>

          {/* 하단: 로그아웃 */}
          <div className="border-t border-slate-200 p-2">
            <button
              onClick={logout}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors",
                collapsed && "justify-center px-2",
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" />
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
            <Badge variant="outline" className="bg-[#7c3aed]/5 border-[#7c3aed]/20 text-[#7c3aed]">
              강사
            </Badge>
            {user && (
              <span className="text-sm text-slate-500">
                {user.center ? `${user.center} 센터` : "전체 센터"}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400">
            카카오 T 고객센터 품질 통합 관리 시스템
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
