import { callGemini } from "@/lib/vertex-ai"
import type { ComplaintCause } from "@/lib/types"

/**
 * AI 불만원인 분류 — 1~2점 리뷰의 코멘트+태그를 분석하여 원인 분류
 *
 * 분류 기준:
 * - 상담사: 상담사의 태도·역량 문제 (불친절, 형식적, 비협조적, 설명부족 등)
 * - 회사정책: 회사의 서비스 정책이나 비즈니스 규정 불만 (요금, 보상, 책임 정책 등)
 * - 상담정책: 상담 채널, 시스템, 프로세스 문제 (전화상담 불가, 정보 미제공, 채팅 불편 등)
 * - 이용자: 고객이나 기사 등 상대방에 대한 불만 (기사 불친절, 승객 태도 등)
 */
export async function classifyComplaintCauses(
  reviews: { index: number; comment: string; tags: string[] }[]
): Promise<Map<number, ComplaintCause>> {
  // 유효한 코멘트만 필터링 (비어있거나 '-'인 건 제외)
  const validReviews = reviews.filter(
    r => r.comment && r.comment.trim() !== "" && r.comment.trim() !== "-"
  )

  if (validReviews.length === 0) {
    return new Map()
  }

  const reviewList = validReviews.map(r => ({
    i: r.index,
    comment: r.comment.slice(0, 200), // 토큰 절약
    tags: r.tags.join(", "),
  }))

  const prompt = `당신은 고객센터 상담평점 분석가입니다.
아래 고객 리뷰의 불만 원인을 분류해주세요.

분류 기준:
- 상담사: 상담사의 태도, 역량, 응대 방식 문제 (불친절, 형식적, 비협조적, 설명부족, 기계적 답변 등)
- 회사정책: 회사의 서비스 정책이나 비즈니스 규정에 대한 불만 (요금, 보상, 책임 정책, 운영방침 등)
- 상담정책: 상담 채널, 시스템, 프로세스 문제 (전화상담 불가, 정보 미제공, 채팅 불편, 연결 지연 등)
- 이용자: 고객이나 기사 등 상대방(서비스 이용자)에 대한 불만 (기사 불친절, 승객 문제, 배달원 태도 등)

JSON 배열로만 응답하세요. 예: [{"i":0,"c":"상담사"},{"i":1,"c":"회사정책"},{"i":2,"c":"이용자"}]
빈 코멘트나 판단 불가 시 해당 항목 생략.

리뷰 목록:
${JSON.stringify(reviewList)}`

  try {
    const raw = await callGemini(prompt)
    // JSON 블록 추출 (```json ... ``` 래핑 대응)
    const jsonStr = raw.replace(/```json\s*/g, "").replace(/```/g, "").trim()
    const arr: { i: number; c: string }[] = JSON.parse(jsonStr)

    const result = new Map<number, ComplaintCause>()
    const validCauses = new Set(["상담사", "회사정책", "상담정책", "이용자"])
    for (const item of arr) {
      if (typeof item.i === "number" && validCauses.has(item.c)) {
        result.set(item.i, item.c as ComplaintCause)
      }
    }
    return result
  } catch (error) {
    console.error("[ai-classify-complaint] Classification failed:", error)
    return new Map() // 분류 실패해도 데이터는 정상 표시
  }
}
