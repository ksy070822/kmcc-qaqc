"use client"

import { useState, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useAuth } from "@/hooks/use-auth"
import {
  Megaphone,
  GraduationCap,
  Send,
  Loader2,
  BarChart3,
  Eye,
  EyeOff,
  Pin,
  AlertTriangle,
  CheckCircle2,
  Users,
  Clock,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* ───────────────────────── Types ───────────────────────── */

interface NoticeFormData {
  noticeType: "announcement" | "education"
  title: string
  content: string
  priority: number
  isPinned: boolean
  centerScope: "all" | "용산" | "광주"
  serviceScope: string
  channelScope: "all" | "유선" | "채팅"
  workHoursScope: "all" | "주간" | "야간" | "심야"
  targetType: "all" | "underperforming" | "new_hire" | "specific"
  specificAgentIds: string
}

interface NoticeWithStats {
  noticeId: string
  title: string
  noticeType: "announcement" | "education"
  priority: number
  isPinned: boolean
  centerScope: string
  createdAt: string
  readCount: number
  totalCount: number
  unreadCount: number
}

interface UnreadAgent {
  userId: string
  userName: string
  center: string
  group?: string
}

const INITIAL_FORM: NoticeFormData = {
  noticeType: "announcement",
  title: "",
  content: "",
  priority: 0,
  isPinned: false,
  centerScope: "all",
  serviceScope: "",
  channelScope: "all",
  workHoursScope: "all",
  targetType: "all",
  specificAgentIds: "",
}

const TYPE_META: Record<string, { label: string; icon: typeof Megaphone; color: string }> = {
  announcement: { label: "공지", icon: Megaphone, color: "bg-blue-50 text-blue-700 border-blue-200" },
  education: { label: "교육", icon: GraduationCap, color: "bg-purple-50 text-purple-700 border-purple-200" },
}

const PRIORITY_META: Record<number, { label: string; color: string }> = {
  0: { label: "일반", color: "bg-slate-100 text-slate-600 border-slate-200" },
  1: { label: "중요", color: "bg-amber-50 text-amber-700 border-amber-200" },
  2: { label: "긴급", color: "bg-red-50 text-red-700 border-red-200" },
}

/* ───────────────────────── Component ───────────────────────── */

export function NoticeManager() {
  const { user } = useAuth()

  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Megaphone className="h-5 w-5 text-[#1e3a5f]" />
          공지 / 교육 관리
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="create">
          <TabsList className="mb-4">
            <TabsTrigger value="create" className="gap-1.5 text-xs">
              <Send className="h-3.5 w-3.5" />
              공지 작성
            </TabsTrigger>
            <TabsTrigger value="status" className="gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" />
              발송 현황
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <CreateNoticeForm userId={user?.userId ?? null} userName={user?.userName ?? null} />
          </TabsContent>

          <TabsContent value="status">
            <NoticeStatusList userId={user?.userId ?? null} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

/* ─────────────── Create Notice Form ─────────────── */

function CreateNoticeForm({
  userId,
  userName,
}: {
  userId: string | null
  userName: string | null
}) {
  const [form, setForm] = useState<NoticeFormData>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const update = useCallback(
    <K extends keyof NoticeFormData>(key: K, value: NoticeFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
      setResult(null)
    },
    [],
  )

  const handleSubmit = useCallback(async () => {
    if (!userId) return
    if (!form.title.trim()) {
      setResult({ ok: false, message: "제목을 입력해 주세요." })
      return
    }
    if (!form.content.trim()) {
      setResult({ ok: false, message: "내용을 입력해 주세요." })
      return
    }
    if (form.targetType === "specific" && !form.specificAgentIds.trim()) {
      setResult({ ok: false, message: "대상 상담사 ID를 입력해 주세요." })
      return
    }

    setSubmitting(true)
    setResult(null)

    try {
      const body = {
        title: form.title,
        content: form.content,
        noticeType: form.noticeType,
        priority: form.priority,
        isPinned: form.isPinned,
        centerScope: form.centerScope,
        serviceScope: form.serviceScope || null,
        channelScope: form.channelScope === "all" ? null : form.channelScope,
        shiftScope: form.workHoursScope === "all" ? null : form.workHoursScope,
        targetType: form.targetType,
        targetAgentIds: form.targetType === "specific"
          ? form.specificAgentIds
              .split(",")
              .map((id) => id.trim())
              .filter(Boolean)
          : undefined,
        createdBy: userId,
        createdByName: userName,
      }

      const res = await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? `발송 실패 (${res.status})`)
      }

      setResult({ ok: true, message: "공지가 성공적으로 발송되었습니다." })
      setForm(INITIAL_FORM)
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
      })
    } finally {
      setSubmitting(false)
    }
  }, [form, userId, userName])

  return (
    <div className="space-y-5">
      {/* 유형 */}
      <FieldRow label="유형">
        <Select
          value={form.noticeType}
          onValueChange={(v) => update("noticeType", v as NoticeFormData["noticeType"])}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="announcement">
              <span className="flex items-center gap-1.5">
                <Megaphone className="h-3.5 w-3.5 text-blue-600" />
                공지
              </span>
            </SelectItem>
            <SelectItem value="education">
              <span className="flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-purple-600" />
                교육
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      {/* 제목 */}
      <FieldRow label="제목">
        <Input
          placeholder="공지 제목을 입력하세요"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          maxLength={100}
        />
      </FieldRow>

      {/* 내용 */}
      <FieldRow label="내용">
        <Textarea
          placeholder="공지 내용을 입력하세요. URL은 자동으로 하이퍼링크 처리됩니다."
          value={form.content}
          onChange={(e) => update("content", e.target.value)}
          rows={5}
          className="min-h-28"
        />
        <p className="text-[11px] text-slate-400 mt-1">
          링크(URL)를 포함하면 상담사 화면에서 자동으로 하이퍼링크로 표시됩니다.
        </p>
      </FieldRow>

      {/* 우선순위 */}
      <FieldRow label="우선순위">
        <Select
          value={String(form.priority)}
          onValueChange={(v) => update("priority", Number(v))}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">일반</SelectItem>
            <SelectItem value="1">중요</SelectItem>
            <SelectItem value="2">긴급</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      {/* 고정 */}
      <FieldRow label="상단 고정">
        <div className="flex items-center gap-2">
          <Checkbox
            id="is-pinned"
            checked={form.isPinned}
            onCheckedChange={(checked) => update("isPinned", checked === true)}
          />
          <label htmlFor="is-pinned" className="text-sm text-slate-600 cursor-pointer select-none">
            공지사항 목록 최상단에 고정합니다
          </label>
        </div>
      </FieldRow>

      {/* 대상 센터 */}
      <FieldRow label="대상 센터">
        <Select
          value={form.centerScope}
          onValueChange={(v) => update("centerScope", v as NoticeFormData["centerScope"])}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="용산">용산</SelectItem>
            <SelectItem value="광주">광주</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      {/* 대상 서비스 */}
      <FieldRow label="대상 서비스">
        <Input
          placeholder="특정 서비스 (미입력 시 전체)"
          value={form.serviceScope}
          onChange={(e) => update("serviceScope", e.target.value)}
        />
      </FieldRow>

      {/* 대상 채널 */}
      <FieldRow label="대상 채널">
        <Select
          value={form.channelScope}
          onValueChange={(v) => update("channelScope", v as NoticeFormData["channelScope"])}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="유선">유선</SelectItem>
            <SelectItem value="채팅">채팅</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      {/* 대상 근무시간대 */}
      <FieldRow label="대상 근무시간대">
        <Select
          value={form.workHoursScope}
          onValueChange={(v) => update("workHoursScope", v as NoticeFormData["workHoursScope"])}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="주간">주간</SelectItem>
            <SelectItem value="야간">야간</SelectItem>
            <SelectItem value="심야">심야</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      {/* 대상 유형 */}
      <FieldRow label="대상 유형">
        <Select
          value={form.targetType}
          onValueChange={(v) => update("targetType", v as NoticeFormData["targetType"])}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="underperforming">집중관리대상</SelectItem>
            <SelectItem value="new_hire">신입</SelectItem>
            <SelectItem value="specific">특정 상담사</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      {/* 특정 상담사 IDs - conditional */}
      {form.targetType === "specific" && (
        <FieldRow label="특정 상담사 ID">
          <Textarea
            placeholder="상담사 ID를 쉼표(,)로 구분하여 입력하세요. 예: agent001, agent002, agent003"
            value={form.specificAgentIds}
            onChange={(e) => update("specificAgentIds", e.target.value)}
            rows={3}
            className="min-h-20 font-mono text-xs"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            쉼표로 구분된 상담사 ID를 입력하세요. 해당 상담사에게만 공지가 발송됩니다.
          </p>
        </FieldRow>
      )}

      {/* Result message */}
      {result && (
        <div
          className={cn(
            "flex items-center gap-2 px-4 py-3 rounded-lg text-sm",
            result.ok
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800",
          )}
        >
          {result.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          )}
          {result.message}
        </div>
      )}

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={submitting || !userId}
        className="w-full bg-[#1e3a5f] hover:bg-[#162d4a] text-white font-semibold py-2.5 text-sm gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            발송 중...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            공지 발송
          </>
        )}
      </Button>
    </div>
  )
}

/* ─────────────── Notice Status List ─────────────── */

function NoticeStatusList({ userId }: { userId: string | null }) {
  const [notices, setNotices] = useState<NoticeWithStats[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Unread modal
  const [unreadModalOpen, setUnreadModalOpen] = useState(false)
  const [unreadAgents, setUnreadAgents] = useState<UnreadAgent[]>([])
  const [unreadLoading, setUnreadLoading] = useState(false)
  const [selectedNoticeTitle, setSelectedNoticeTitle] = useState("")

  const fetchNotices = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/notices?createdBy=${encodeURIComponent(userId)}`)
      if (!res.ok) throw new Error(`불러오기 실패 (${res.status})`)
      const json = await res.json()
      setNotices(json.notices ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류")
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchNotices()
  }, [fetchNotices])

  const handleShowUnread = useCallback(async (noticeId: string, title: string) => {
    setSelectedNoticeTitle(title)
    setUnreadModalOpen(true)
    setUnreadLoading(true)
    setUnreadAgents([])
    try {
      const res = await fetch(
        `/api/notices?action=unread-agents&noticeId=${encodeURIComponent(noticeId)}`,
      )
      if (!res.ok) throw new Error("미확인 목록 조회 실패")
      const json = await res.json()
      setUnreadAgents(json.agents ?? [])
    } catch {
      setUnreadAgents([])
    } finally {
      setUnreadLoading(false)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">발송 현황을 불러오는 중...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <AlertTriangle className="h-6 w-6 text-red-400" />
        <p className="text-sm text-red-600">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchNotices} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          다시 시도
        </Button>
      </div>
    )
  }

  if (notices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <Megaphone className="h-10 w-10 mb-3 text-slate-300" />
        <p className="text-sm">발송한 공지가 없습니다</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-500">
          총 <span className="font-semibold text-slate-700">{notices.length}</span>건
        </p>
        <Button variant="outline" size="sm" onClick={fetchNotices} className="gap-1.5 text-xs h-7">
          <RefreshCw className="h-3 w-3" />
          새로고침
        </Button>
      </div>

      <div className="space-y-3">
        {notices.map((notice) => {
          const typeMeta = TYPE_META[notice.noticeType] ?? TYPE_META.announcement
          const TypeIcon = typeMeta.icon
          const priorityMeta = PRIORITY_META[notice.priority] ?? PRIORITY_META[0]
          const readPct = notice.totalCount > 0
            ? Math.round((notice.readCount / notice.totalCount) * 100)
            : 0

          return (
            <div
              key={notice.noticeId}
              className="border border-slate-200 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow"
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    {notice.isPinned && <Pin className="h-3 w-3 text-amber-500 shrink-0" />}
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", typeMeta.color)}>
                      <TypeIcon className="h-2.5 w-2.5 mr-0.5" />
                      {typeMeta.label}
                    </Badge>
                    {notice.priority > 0 && (
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", priorityMeta.color)}>
                        {priorityMeta.label}
                      </Badge>
                    )}
                    {notice.centerScope !== "all" && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50 text-slate-600 border-slate-200">
                        {notice.centerScope}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {notice.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400">
                    <Clock className="h-3 w-3" />
                    <span>{notice.createdAt}</span>
                  </div>
                </div>

                {/* Read ratio */}
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 text-xs text-slate-600 mb-0.5">
                    <Eye className="h-3 w-3" />
                    <span className="font-semibold">{notice.readCount}</span>
                    <span className="text-slate-400">/</span>
                    <span>{notice.totalCount}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">{readPct}% 확인</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-2">
                <Progress
                  value={readPct}
                  className={cn(
                    "h-1.5",
                    readPct === 100 ? "[&>[data-slot=progress-indicator]]:bg-green-500" : "[&>[data-slot=progress-indicator]]:bg-[#2c6edb]",
                  )}
                />
              </div>

              {/* Unread button */}
              {notice.unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-xs h-8 border-slate-200 hover:bg-slate-50 text-slate-600"
                  onClick={() => handleShowUnread(notice.noticeId, notice.title)}
                >
                  <EyeOff className="h-3 w-3 text-amber-500" />
                  미확인 {notice.unreadCount}명 보기
                </Button>
              )}

              {notice.unreadCount === 0 && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-green-600 py-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  전원 확인 완료
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Unread agents modal */}
      <Dialog open={unreadModalOpen} onOpenChange={setUnreadModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <EyeOff className="h-4 w-4 text-amber-500" />
              미확인 상담사
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {selectedNoticeTitle}
            </DialogDescription>
          </DialogHeader>

          {unreadLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              <span className="ml-2 text-sm text-slate-500">조회 중...</span>
            </div>
          ) : unreadAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <CheckCircle2 className="h-8 w-8 mb-2 text-green-400" />
              <p className="text-sm">미확인 상담사가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2 px-1">
                <Users className="h-3.5 w-3.5" />
                <span>총 {unreadAgents.length}명</span>
              </div>
              {unreadAgents.map((agent) => (
                <div
                  key={agent.userId}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-100"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-slate-800 truncate">
                      {agent.userName}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {agent.userId}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        agent.center === "용산"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-yellow-50 text-yellow-700 border-yellow-200",
                      )}
                    >
                      {agent.center}
                    </Badge>
                    {agent.group && (
                      <span className="text-[11px] text-slate-400">{agent.group}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ─────────────── Shared Layout Helper ─────────────── */

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-700">{label}</Label>
      {children}
    </div>
  )
}
