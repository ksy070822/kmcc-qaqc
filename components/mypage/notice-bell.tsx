"use client"

import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useUnreadNoticeCount } from "@/hooks/use-notices"

interface NoticeBellProps {
  agentId: string | null
  center: string | null
}

export function NoticeBell({ agentId, center }: NoticeBellProps) {
  const router = useRouter()
  const { count } = useUnreadNoticeCount(agentId, center)

  return (
    <button
      onClick={() => router.push("/mypage/notices")}
      className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
      aria-label="공지사항"
    >
      <Bell className="h-5 w-5 text-slate-500" />
      {count > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] font-bold flex items-center justify-center"
        >
          {count > 99 ? "99+" : count}
        </Badge>
      )}
    </button>
  )
}
