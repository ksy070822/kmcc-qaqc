"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { useNotices } from "@/hooks/use-notices"
import { useAuth } from "@/hooks/use-auth"
import {
  Loader2,
  Megaphone,
  GraduationCap,
  Pin,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import type { Notice } from "@/lib/types"

const typeLabels: Record<string, { label: string; icon: typeof Megaphone; color: string }> = {
  announcement: { label: "공지", icon: Megaphone, color: "bg-blue-50 text-blue-700 border-blue-200" },
  education: { label: "교육", icon: GraduationCap, color: "bg-purple-50 text-purple-700 border-purple-200" },
}

function NoticeCard({
  notice,
  onConfirm,
  confirming,
}: {
  notice: Notice
  onConfirm: (noticeId: string) => void
  confirming: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const typeInfo = typeLabels[notice.noticeType] || typeLabels.announcement
  const TypeIcon = typeInfo.icon
  const isConfirming = confirming === notice.noticeId

  return (
    <div
      className={cn(
        "border rounded-xl transition-all",
        notice.isRead
          ? "bg-white border-slate-200"
          : "bg-amber-50/40 border-amber-300 shadow-sm",
        notice.isPinned && "ring-1 ring-amber-300",
      )}
    >
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* 확인 상태 아이콘 */}
        <div className="pt-0.5 shrink-0">
          {notice.isRead ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-500" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {notice.isPinned && <Pin className="h-3 w-3 text-amber-500 shrink-0" />}
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", typeInfo.color)}>
              <TypeIcon className="h-2.5 w-2.5 mr-0.5" />
              {typeInfo.label}
            </Badge>
            {notice.priority >= 2 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">긴급</Badge>
            )}
            {notice.priority === 1 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">중요</Badge>
            )}
            {notice.isRead ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-600 border-green-200">
                확인완료
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 animate-pulse">
                미확인
              </Badge>
            )}
          </div>
          <p className={cn(
            "text-sm font-medium truncate",
            notice.isRead ? "text-slate-600" : "text-slate-900 font-semibold",
          )}>
            {notice.title}
          </p>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
            <span>{notice.createdAt}</span>
            <span>{notice.createdBy}</span>
            {notice.centerScope !== "all" && <span>{notice.centerScope}</span>}
            {notice.isRead && notice.readAt && (
              <span className="text-green-500">({notice.readAt} 확인)</span>
            )}
          </div>
        </div>

        {/* Expand icon */}
        <div className="pt-1 shrink-0">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 ml-10">
          <div className="border-t border-slate-100 pt-3">
            <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {notice.content || "내용 없음"}
            </div>

            {/* 확인완료 버튼 */}
            {!notice.isRead && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    onConfirm(notice.noticeId)
                  }}
                  disabled={isConfirming}
                  className="w-full bg-[#1e3a5f] hover:bg-[#162d4a] text-white font-semibold py-2.5 text-sm gap-2"
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      처리 중...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      확인완료
                    </>
                  )}
                </Button>
                <p className="text-[11px] text-center text-slate-400 mt-1.5">
                  내용을 확인한 후 반드시 확인완료 버튼을 눌러주세요
                </p>
              </div>
            )}

            {/* 이미 확인된 경우 */}
            {notice.isRead && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>{notice.readAt} 확인 완료</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function MypageNotices() {
  const { user } = useAuth()
  const [tab, setTab] = useState("all")
  const [confirming, setConfirming] = useState<string | null>(null)
  const typeFilter = tab === "all" ? undefined : tab
  const { data, loading, refetch } = useNotices(
    user?.userId ?? null,
    user?.center ?? null,
    typeFilter,
  )

  const handleConfirm = useCallback(
    async (noticeId: string) => {
      if (!user?.userId) return
      setConfirming(noticeId)
      try {
        await fetch("/api/mypage/notices/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noticeId, userId: user.userId }),
        })
        refetch()
      } catch {
        // silent
      } finally {
        setConfirming(null)
      }
    },
    [user?.userId, refetch],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">공지사항을 불러오는 중...</span>
      </div>
    )
  }

  const notices = data?.notices ?? []
  const unreadCount = data?.unreadCount ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900">공지사항 / 교육</h2>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs animate-pulse">
              {unreadCount}건 미확인
            </Badge>
          )}
        </div>
      </div>

      {/* 미확인 안내 배너 */}
      {unreadCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            미확인 공지가 <span className="font-bold">{unreadCount}건</span> 있습니다. 각 항목을 펼쳐서 <span className="font-bold">확인완료</span> 버튼을 눌러주세요.
          </p>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">전체</TabsTrigger>
          <TabsTrigger value="announcement">공지</TabsTrigger>
          <TabsTrigger value="education">교육</TabsTrigger>
        </TabsList>
      </Tabs>

      {notices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Megaphone className="h-10 w-10 mb-3 text-slate-300" />
          <p className="text-sm">공지사항이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notices.map((notice) => (
            <NoticeCard
              key={notice.noticeId}
              notice={notice}
              onConfirm={handleConfirm}
              confirming={confirming}
            />
          ))}
        </div>
      )}
    </div>
  )
}
