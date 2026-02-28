"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { CSATReviewRow, ComplaintCause } from "@/lib/types"

interface Props {
  data: {
    summary: { positive: number; negative: number; total: number }
    reviews: CSATReviewRow[]
  } | null
}

type SentimentFilter = "all" | "POSITIVE" | "NEGATIVE"

const MAX_VISIBLE_TAGS = 3

function ComplaintBadge({ cause }: { cause?: ComplaintCause }) {
  if (!cause) return <span className="text-muted-foreground">-</span>
  const styles: Record<string, string> = {
    "상담사": "bg-orange-100 text-orange-800",
    "회사정책": "bg-purple-100 text-purple-800",
    "상담정책": "bg-cyan-100 text-cyan-800",
    "이용자": "bg-amber-100 text-amber-800",
  }
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap", styles[cause] || "bg-gray-100 text-gray-700")}>
      {cause}
    </span>
  )
}

function TagCell({ tags, sentiment }: { tags: string[]; sentiment: "POSITIVE" | "NEGATIVE" | null }) {
  if (tags.length === 0) return <span className="text-muted-foreground">-</span>

  const colorClass = sentiment === "POSITIVE" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"
  const visible = tags.slice(0, MAX_VISIBLE_TAGS)
  const remaining = tags.length - MAX_VISIBLE_TAGS

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 max-h-[28px] overflow-hidden cursor-default">
            {visible.map((tag, ti) => (
              <span key={ti} className={cn("px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap", colorClass)}>
                {tag}
              </span>
            ))}
            {remaining > 0 && (
              <span className="px-1 py-0.5 rounded bg-gray-200 text-gray-600 text-[10px] whitespace-nowrap">
                +{remaining}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[300px]">
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, ti) => (
              <span key={ti} className={cn("px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap", colorClass)}>
                {tag}
              </span>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function CommentCell({ comment }: { comment: string }) {
  if (!comment || comment === "-") return <span className="text-muted-foreground">-</span>

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block truncate cursor-default">{comment}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[400px] whitespace-pre-wrap text-xs">
          {comment}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function CSATReviewList({ data }: Props) {
  const [filter, setFilter] = useState<SentimentFilter>("all")

  if (!data || data.reviews.length === 0) {
    return <div className="text-center text-muted-foreground text-xs py-8">태그가 포함된 리뷰 데이터가 없습니다</div>
  }

  const { summary, reviews } = data
  const positiveRate = summary.total > 0 ? (summary.positive / summary.total) * 100 : 0
  const negativeRate = summary.total > 0 ? (summary.negative / summary.total) * 100 : 0

  const filtered = filter === "all"
    ? reviews
    : reviews.filter(r => r.sentiment === filter)

  const filterButtons: { value: SentimentFilter; label: string }[] = [
    { value: "all", label: `전체 (${summary.total})` },
    { value: "POSITIVE", label: `긍정 (${summary.positive})` },
    { value: "NEGATIVE", label: `부정 (${summary.negative})` },
  ]

  return (
    <div className="space-y-4">
      {/* 긍정/부정 요약 바 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-400" />
          <span className="text-xs">긍정 <span className="font-semibold">{summary.positive.toLocaleString("ko-KR")}건</span> ({positiveRate.toFixed(1)}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-red-400" />
          <span className="text-xs">부정 <span className="font-semibold">{summary.negative.toLocaleString("ko-KR")}건</span> ({negativeRate.toFixed(1)}%)</span>
        </div>
        <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden flex">
          <div className="h-full bg-blue-400 transition-all" style={{ width: `${positiveRate}%` }} />
          <div className="h-full bg-red-400 transition-all" style={{ width: `${negativeRate}%` }} />
        </div>
      </div>

      {/* 필터 토글 */}
      <div className="flex gap-1">
        {filterButtons.map(btn => (
          <button
            key={btn.value}
            onClick={() => setFilter(btn.value)}
            className={cn(
              "px-3 py-1.5 text-xs border rounded-md cursor-pointer transition-colors",
              filter === btn.value
                ? "bg-slate-700 text-white border-slate-700"
                : "bg-white text-gray-600 border-slate-200 hover:bg-gray-50"
            )}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* 리뷰 테이블 */}
      <div className="max-h-[500px] overflow-y-auto">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-[70px]">날짜</TableHead>
              <TableHead className="text-xs w-[120px]">상담사(ID)</TableHead>
              <TableHead className="text-xs w-[60px]">서비스</TableHead>
              <TableHead className="text-xs w-[40px] text-center">점수</TableHead>
              <TableHead className="text-xs w-[200px]">선택태그</TableHead>
              <TableHead className="text-xs w-[160px]">코멘트</TableHead>
              <TableHead className="text-xs w-[55px] text-center">긍/부정</TableHead>
              <TableHead className="text-xs w-[80px] text-center">불만원인</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground text-xs py-8">해당 필터 조건의 리뷰가 없습니다</TableCell></TableRow>
            ) : filtered.map((row, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs text-muted-foreground">{row.date.slice(5)}</TableCell>
                <TableCell className="text-xs truncate">{row.agentName}<span className="text-muted-foreground ml-1">({row.agentId})</span></TableCell>
                <TableCell className="text-xs">{row.service}</TableCell>
                <TableCell className={cn("text-xs text-center font-medium", row.score <= 2 ? "text-red-600" : row.score >= 4 ? "text-blue-600" : "")}>
                  {row.score}
                </TableCell>
                <TableCell className="text-xs">
                  <TagCell tags={row.tags} sentiment={row.sentiment} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <CommentCell comment={row.comment} />
                </TableCell>
                <TableCell className="text-xs text-center">
                  {row.sentiment === "POSITIVE" && <span className="text-blue-600 font-medium">긍정</span>}
                  {row.sentiment === "NEGATIVE" && <span className="text-red-600 font-medium">부정</span>}
                  {!row.sentiment && <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell className="text-xs text-center">
                  <ComplaintBadge cause={row.complaintCause} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filtered.length >= 100 && (
        <p className="text-xs text-muted-foreground text-center">최대 100건까지 표시됩니다</p>
      )}
    </div>
  )
}
