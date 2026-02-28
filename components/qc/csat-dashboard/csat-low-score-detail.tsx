"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { CSATLowScoreWeekly, ComplaintCause } from "@/lib/types"

interface Props {
  data: CSATLowScoreWeekly[]
}

type ScoreTab = "score1" | "score2"

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

function TagCell({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className="text-muted-foreground">-</span>

  const visible = tags.slice(0, MAX_VISIBLE_TAGS)
  const remaining = tags.length - MAX_VISIBLE_TAGS

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 max-h-[28px] overflow-hidden cursor-default">
            {visible.map((tag, ti) => (
              <span key={ti} className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-[10px] whitespace-nowrap">
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
              <span key={ti} className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-[10px] whitespace-nowrap">
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

function NegativeTagSummary({
  counts,
  prevCounts,
}: {
  counts?: Record<string, number>
  prevCounts?: Record<string, number>
}) {
  if (!counts || Object.keys(counts).length === 0) return null

  const allTags = new Set([...Object.keys(counts), ...(prevCounts ? Object.keys(prevCounts) : [])])

  return (
    <div className="flex flex-wrap gap-1.5">
      {[...allTags]
        .sort((a, b) => (counts[b] || 0) - (counts[a] || 0))
        .map(tag => {
          const cur = counts[tag] || 0
          const prev = prevCounts?.[tag] || 0
          const diff = cur - prev
          return (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-[10px]"
            >
              <span className="text-red-800 font-medium">{tag}</span>
              <span className="text-red-600">{cur}건</span>
              {prevCounts && (
                <span className={cn(
                  "font-semibold",
                  diff > 0 ? "text-red-600" : diff < 0 ? "text-emerald-600" : "text-gray-400"
                )}>
                  {diff > 0 ? `▲+${diff}` : diff < 0 ? `▼${diff}` : "―"}
                </span>
              )}
            </span>
          )
        })}
    </div>
  )
}

export function CSATLowScoreDetail({ data }: Props) {
  const [scoreTab, setScoreTab] = useState<ScoreTab>("score1")

  if (!data || data.length === 0) {
    return <div className="text-center text-muted-foreground text-xs py-8">데이터가 없습니다</div>
  }

  return (
    <div className="space-y-4">
      {data.map((week, idx) => {
        const changeRate = week.prevLowRate !== undefined
          ? Math.round((week.lowRate - week.prevLowRate) * 100) / 100
          : null

        const reviews = scoreTab === "score1" ? week.score1Reviews : week.score2Reviews

        return (
          <Card key={idx} className={idx === 0 ? "border-blue-200 bg-blue-50/30" : ""}>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-semibold flex items-center gap-2 flex-wrap">
                <span>{week.period}</span>
                <span className="text-muted-foreground font-normal">
                  총 응답 {week.totalReviews.toLocaleString("ko-KR")}건 중
                  1,2점 <span className="font-semibold text-red-600">{week.lowCount}건</span>
                  {" / "}전체의 {week.lowRate.toFixed(1)}%
                </span>
                {changeRate !== null && (
                  <span className={changeRate <= 0 ? "text-emerald-600 text-xs" : "text-red-600 text-xs"}>
                    / 전주대비 {changeRate > 0 ? "+" : ""}{changeRate.toFixed(2)}%p
                    {changeRate <= 0 ? "▼" : "▲"}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-3">
              {/* 부정태그 전주대비 증감 요약 */}
              <NegativeTagSummary
                counts={week.negativeTagCounts}
                prevCounts={week.prevNegativeTagCounts}
              />

              {/* 1점/2점 건수 요약 + 탭 토글 */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setScoreTab("score1")}
                  className={cn(
                    "px-3 py-1.5 text-xs border rounded-md cursor-pointer transition-colors",
                    scoreTab === "score1"
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-white text-red-700 border-red-200 hover:bg-red-50"
                  )}
                >
                  1점 {week.score1Count}건
                </button>
                <button
                  onClick={() => setScoreTab("score2")}
                  className={cn(
                    "px-3 py-1.5 text-xs border rounded-md cursor-pointer transition-colors",
                    scoreTab === "score2"
                      ? "bg-orange-600 text-white border-orange-600"
                      : "bg-white text-orange-700 border-orange-200 hover:bg-orange-50"
                  )}
                >
                  2점 {week.score2Count}건
                </button>
              </div>

              {/* 개별 리뷰 테이블 */}
              {reviews.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">해당 점수의 리뷰가 없습니다</p>
              ) : (
                <div className="max-h-[300px] overflow-y-auto">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-[70px]">날짜</TableHead>
                        <TableHead className="text-xs w-[120px]">상담사(ID)</TableHead>
                        <TableHead className="text-xs w-[60px]">서비스</TableHead>
                        <TableHead className="text-xs w-[200px]">선택태그</TableHead>
                        <TableHead className="text-xs w-[160px]">코멘트</TableHead>
                        <TableHead className="text-xs w-[80px] text-center">불만원인</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reviews.map((review, ri) => (
                        <TableRow key={ri}>
                          <TableCell className="text-xs text-muted-foreground">{review.date.slice(5)}</TableCell>
                          <TableCell className="text-xs truncate">{review.agentName}<span className="text-muted-foreground ml-1">({review.agentId})</span></TableCell>
                          <TableCell className="text-xs">{review.service}</TableCell>
                          <TableCell className="text-xs">
                            <TagCell tags={review.tags} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <CommentCell comment={review.comment} />
                          </TableCell>
                          <TableCell className="text-xs text-center">
                            <ComplaintBadge cause={review.complaintCause} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
