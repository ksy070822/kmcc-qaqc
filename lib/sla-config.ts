/**
 * SLA 평가 배점 설정 + 등급 판정 로직
 *
 * 데이터 출처:
 *   용산 — docs/26년1월_SLA_KMCC_용산_0202.xlsx > KMCC_용산 시트 (실제 적용 기준)
 *   광주 — docs/26년 1월 KMCC광주센터 SLA 평가 검수.xlsx > KMCC_광주 시트 (실제 적용 기준)
 *
 * 주의: docs/26년 SLA_광주.xlsx (기준서 제안)과 실제 적용 기준은 다름.
 *        실제 적용: 퀵 없음, 8-tier, 배점/목표 용산과 동일
 *
 * 26년 기준: 생산성 60점 + 품질 40점 + 인력관리(가감점) + 기타가감점
 */

import type { SLAConfig, SLAMetric, SLAGrade, SLAResult, SLAScoreDetail, SLADeduction, CenterName } from "./types"

// ============================================================
// 등급 판정 기준 (용산/광주 동일)
// ============================================================

const GRADE_TABLE: { grade: SLAGrade; minScore: number; rate: number }[] = [
  { grade: "S", minScore: 94, rate: 1.03 },
  { grade: "A", minScore: 92, rate: 1.01 },
  { grade: "B", minScore: 90, rate: 1.00 },
  { grade: "C", minScore: 85, rate: 0.99 },
  { grade: "D", minScore: 80, rate: 0.98 },
  { grade: "E", minScore: 0, rate: 0.97 },
]

export function getGrade(totalScore: number): { grade: SLAGrade; rate: number } {
  for (const row of GRADE_TABLE) {
    if (totalScore >= row.minScore) {
      return { grade: row.grade, rate: row.rate }
    }
  }
  return { grade: "E", rate: 0.97 }
}

export { GRADE_TABLE }

// ============================================================
// 용산 SLA 설정 (26년 — 실제 적용 기준)
// ============================================================
// 생산성 60점 = 응대율(유선)15 + 응대율(채팅)5 + 처리시간 4개×10
// 품질 40점 = QA 15 + 상담리뷰 15 + 직무테스트 10
// 인력관리 = 상담사 퇴사율(1~7점)
// 가감점 = 관리자 퇴사(+1/-1/-2) + 오처리(-1/-0.5/건) + 보안(-2/건)

const YONGSAN_CONFIG: SLAConfig = {
  center: "용산",
  year: 2026,
  productivity: [
    {
      id: "voice_response_rate",
      name: "응대율(유선)",
      category: "생산성",
      maxScore: 15,
      tiers: [
        // 8단계, "초과" = exclusive (실무상 >=로 처리, 소수점이라 경계 충돌 없음)
        { label: "85% 초과", minValue: 85, score: 15 },
        { label: "83% 초과", minValue: 83, score: 13 },
        { label: "81% 초과", minValue: 81, score: 11 },
        { label: "79% 초과", minValue: 79, score: 9 },
        { label: "77% 초과", minValue: 77, score: 7 },
        { label: "75% 초과", minValue: 75, score: 5 },
        { label: "73% 초과", minValue: 73, score: 3 },
        { label: "73% 이하", minValue: 0, score: 1 },
      ],
      unit: "%",
      direction: "higher_better",
    },
    {
      id: "chat_response_rate",
      name: "응대율(채팅)",
      category: "생산성",
      maxScore: 5,
      tiers: [
        // 5단계
        { label: "90% 초과", minValue: 90, score: 5 },
        { label: "88% 초과", minValue: 88, score: 4 },
        { label: "86% 초과", minValue: 86, score: 3 },
        { label: "84% 초과", minValue: 84, score: 2 },
        { label: "84% 이하", minValue: 0, score: 1 },
      ],
      unit: "%",
      direction: "higher_better",
    },
    {
      // 택시(유선) 처리시간 — 목표 3분13초(193초), 10초 간격 8단계
      id: "taxi_voice_handling",
      name: "택시(유선) 처리시간",
      category: "생산성",
      maxScore: 10,
      tiers: [
        { label: "3분13초 이하", maxValue: 193, score: 10 },
        { label: "3분23초 이하", maxValue: 203, score: 9 },
        { label: "3분33초 이하", maxValue: 213, score: 8 },
        { label: "3분44초 이하", maxValue: 224, score: 7 },
        { label: "3분54초 이하", maxValue: 234, score: 6 },
        { label: "4분04초 이하", maxValue: 244, score: 5 },
        { label: "4분14초 이하", maxValue: 254, score: 4 },
        { label: "4분14초 초과", maxValue: 99999, score: 1 },
      ],
      unit: "초",
      direction: "lower_better",
    },
    {
      // 대리(유선) 처리시간 — 목표 3분05초(185초), 10초 간격 8단계
      id: "driver_voice_handling",
      name: "대리(유선) 처리시간",
      category: "생산성",
      maxScore: 10,
      tiers: [
        { label: "3분05초 이하", maxValue: 185, score: 10 },
        { label: "3분15초 이하", maxValue: 195, score: 9 },
        { label: "3분25초 이하", maxValue: 205, score: 8 },
        { label: "3분35초 이하", maxValue: 215, score: 7 },
        { label: "3분45초 이하", maxValue: 225, score: 6 },
        { label: "3분55초 이하", maxValue: 235, score: 5 },
        { label: "4분05초 이하", maxValue: 245, score: 4 },
        { label: "4분05초 초과", maxValue: 99999, score: 1 },
      ],
      unit: "초",
      direction: "lower_better",
    },
    {
      // 택시(채팅) 처리시간 — 목표 8분45초(525초), 10초 간격 8단계
      id: "taxi_chat_handling",
      name: "택시(채팅) 처리시간",
      category: "생산성",
      maxScore: 10,
      tiers: [
        { label: "8분45초 이하", maxValue: 525, score: 10 },
        { label: "8분55초 이하", maxValue: 535, score: 9 },
        { label: "9분05초 이하", maxValue: 545, score: 8 },
        { label: "9분15초 이하", maxValue: 555, score: 7 },
        { label: "9분25초 이하", maxValue: 565, score: 6 },
        { label: "9분35초 이하", maxValue: 575, score: 5 },
        { label: "9분45초 이하", maxValue: 585, score: 4 },
        { label: "9분45초 초과", maxValue: 99999, score: 1 },
      ],
      unit: "초",
      direction: "lower_better",
    },
    {
      // 대리(채팅) 처리시간 — 목표 7분56초(476초), 10초 간격 8단계
      id: "driver_chat_handling",
      name: "대리(채팅) 처리시간",
      category: "생산성",
      maxScore: 10,
      tiers: [
        { label: "7분56초 이하", maxValue: 476, score: 10 },
        { label: "8분06초 이하", maxValue: 486, score: 9 },
        { label: "8분16초 이하", maxValue: 496, score: 8 },
        { label: "8분26초 이하", maxValue: 506, score: 7 },
        { label: "8분36초 이하", maxValue: 516, score: 6 },
        { label: "8분46초 이하", maxValue: 526, score: 5 },
        { label: "8분56초 이하", maxValue: 536, score: 4 },
        { label: "8분56초 초과", maxValue: 99999, score: 1 },
      ],
      unit: "초",
      direction: "lower_better",
    },
  ],
  quality: [
    {
      // QA 평가 — 목표 87점, 2점 간격 8단계
      id: "qa_score",
      name: "QA 평가",
      category: "품질",
      maxScore: 15,
      tiers: [
        { label: "87점 이상", minValue: 87, score: 15 },
        { label: "85점 초과", minValue: 85, score: 13 },
        { label: "83점 초과", minValue: 83, score: 11 },
        { label: "81점 초과", minValue: 81, score: 9 },
        { label: "79점 초과", minValue: 79, score: 7 },
        { label: "77점 초과", minValue: 77, score: 5 },
        { label: "75점 초과", minValue: 75, score: 3 },
        { label: "75점 이하", minValue: 0, score: 1 },
      ],
      unit: "점",
      direction: "higher_better",
    },
    {
      // 상담평점 — 목표 4.8점, 0.1점 간격 8단계
      id: "csat_score",
      name: "상담평점",
      category: "품질",
      maxScore: 15,
      tiers: [
        { label: "4.8점 이상", minValue: 4.8, score: 15 },
        { label: "4.7점 초과", minValue: 4.7, score: 13 },
        { label: "4.6점 초과", minValue: 4.6, score: 11 },
        { label: "4.5점 초과", minValue: 4.5, score: 9 },
        { label: "4.4점 초과", minValue: 4.4, score: 7 },
        { label: "4.3점 초과", minValue: 4.3, score: 5 },
        { label: "4.2점 초과", minValue: 4.2, score: 3 },
        { label: "4.2점 이하", minValue: 0, score: 1 },
      ],
      unit: "점",
      direction: "higher_better",
    },
    {
      // 직무테스트 — 목표 90점, 2점 간격 5단계
      id: "quiz_score",
      name: "직무테스트",
      category: "품질",
      maxScore: 10,
      tiers: [
        { label: "90점 이상", minValue: 90, score: 10 },
        { label: "88점 초과", minValue: 88, score: 8 },
        { label: "86점 초과", minValue: 86, score: 6 },
        { label: "84점 초과", minValue: 84, score: 4 },
        { label: "84점 이하", minValue: 0, score: 2 },
      ],
      unit: "점",
      direction: "higher_better",
    },
  ],
  personnel: [
    {
      // 상담사 퇴사율 — 목표 5%, 1% 간격 7단계 (낮을수록 좋음)
      // 퇴사인원/매월1일 재직인원 (1개월미만, 8H/6H/4H 제외)
      id: "turnover_rate",
      name: "상담사 퇴사율",
      category: "인력관리",
      maxScore: 7,
      tiers: [
        { label: "5% 미만", maxValue: 5, score: 7 },
        { label: "6% 미만", maxValue: 6, score: 6 },
        { label: "7% 미만", maxValue: 7, score: 5 },
        { label: "8% 미만", maxValue: 8, score: 4 },
        { label: "9% 미만", maxValue: 9, score: 3 },
        { label: "10% 미만", maxValue: 10, score: 2 },
        { label: "10% 이상", maxValue: 99999, score: 1 },
      ],
      unit: "%",
      direction: "lower_better",
    },
  ],
  deductions: [],
  // 가감점 정의 (런타임에 실제 값 전달):
  // - 관리자 퇴사: 미퇴사 +1 / 1년미만 -1 / 1년이상 -2
  // - 오처리(대외민원): 건당 -1점
  // - 오처리(매니저확인): 건당 -0.5점
  // - 보안점검: 건당 -2점
}

// ============================================================
// 광주 SLA 설정 (26년 — 실제 적용 기준)
// ============================================================
// 출처: docs/26년 1월 KMCC광주센터 SLA 평가 검수.xlsx > KMCC_광주
// 주의: 기준서(26년 SLA_광주.xlsx)와 실제 적용 기준이 다름!
//   - 기준서: 퀵 있음(9점), 응대율유선 10점/5-tier, 처리시간 9점/6-tier
//   - 실제:   퀵 없음,      응대율유선 15점/8-tier, 처리시간 10점/8-tier (용산과 동일)
//   - QA 목표: 기준서 89점 → 실제 87점 / 상담평점 목표: 기준서 4.85 → 실제 4.8
//
// 생산성 60점 = 응대율(유선)15 + 응대율(채팅)5 + 처리시간 4개×10
// 품질 40점 = QA 15 + 상담리뷰 15 + 직무테스트 10
// 인력관리 = 상담사 퇴사율(1~7점)
// 가감점 = 관리자 퇴사(+1/-1/-2) + 오처리(-1/-0.1/건) + 보안(-2/건)

const GWANGJU_CONFIG: SLAConfig = {
  center: "광주",
  year: 2026,
  productivity: [
    {
      id: "voice_response_rate",
      name: "응대율(유선)",
      category: "생산성",
      maxScore: 15,
      tiers: [
        // 8단계 (실제 적용 — 용산과 동일)
        { label: "85% 초과", minValue: 85, score: 15 },
        { label: "83% 초과", minValue: 83, score: 13 },
        { label: "81% 초과", minValue: 81, score: 11 },
        { label: "79% 초과", minValue: 79, score: 9 },
        { label: "77% 초과", minValue: 77, score: 7 },
        { label: "75% 초과", minValue: 75, score: 5 },
        { label: "73% 초과", minValue: 73, score: 3 },
        { label: "73% 이하", minValue: 0, score: 1 },
      ],
      unit: "%",
      direction: "higher_better",
    },
    {
      id: "chat_response_rate",
      name: "응대율(채팅)",
      category: "생산성",
      maxScore: 5,
      tiers: [
        // 5단계 (기준서와 동일)
        { label: "90% 초과", minValue: 90, score: 5 },
        { label: "88% 초과", minValue: 88, score: 4 },
        { label: "86% 초과", minValue: 86, score: 3 },
        { label: "84% 초과", minValue: 84, score: 2 },
        { label: "84% 이하", minValue: 0, score: 1 },
      ],
      unit: "%",
      direction: "higher_better",
    },
    {
      // 유선_택시 — 목표 3분13초(193초), 10초 간격 8단계
      id: "taxi_voice_handling",
      name: "택시(유선) 처리시간",
      category: "생산성",
      maxScore: 10,
      tiers: [
        { label: "3분13초 이하", maxValue: 193, score: 10 },
        { label: "3분23초 이하", maxValue: 203, score: 9 },
        { label: "3분33초 이하", maxValue: 213, score: 8 },
        { label: "3분44초 이하", maxValue: 224, score: 7 },
        { label: "3분54초 이하", maxValue: 234, score: 6 },
        { label: "4분04초 이하", maxValue: 244, score: 5 },
        { label: "4분14초 이하", maxValue: 254, score: 4 },
        { label: "4분14초 초과", maxValue: 99999, score: 1 },
      ],
      unit: "초",
      direction: "lower_better",
    },
    {
      // 유선_대리 — 목표 3분05초(185초), 10초 간격 8단계
      id: "driver_voice_handling",
      name: "대리(유선) 처리시간",
      category: "생산성",
      maxScore: 10,
      tiers: [
        { label: "3분05초 이하", maxValue: 185, score: 10 },
        { label: "3분15초 이하", maxValue: 195, score: 9 },
        { label: "3분25초 이하", maxValue: 205, score: 8 },
        { label: "3분35초 이하", maxValue: 215, score: 7 },
        { label: "3분45초 이하", maxValue: 225, score: 6 },
        { label: "3분55초 이하", maxValue: 235, score: 5 },
        { label: "4분05초 이하", maxValue: 245, score: 4 },
        { label: "4분05초 초과", maxValue: 99999, score: 1 },
      ],
      unit: "초",
      direction: "lower_better",
    },
    {
      // 채팅_택시 — 목표 8분45초(525초), 10초 간격 8단계
      id: "taxi_chat_handling",
      name: "택시(채팅) 처리시간",
      category: "생산성",
      maxScore: 10,
      tiers: [
        { label: "8분45초 이하", maxValue: 525, score: 10 },
        { label: "8분55초 이하", maxValue: 535, score: 9 },
        { label: "9분05초 이하", maxValue: 545, score: 8 },
        { label: "9분15초 이하", maxValue: 555, score: 7 },
        { label: "9분25초 이하", maxValue: 565, score: 6 },
        { label: "9분35초 이하", maxValue: 575, score: 5 },
        { label: "9분45초 이하", maxValue: 585, score: 4 },
        { label: "9분45초 초과", maxValue: 99999, score: 1 },
      ],
      unit: "초",
      direction: "lower_better",
    },
    {
      // 채팅_대리 — 목표 7분56초(476초), 10초 간격 8단계
      id: "driver_chat_handling",
      name: "대리(채팅) 처리시간",
      category: "생산성",
      maxScore: 10,
      tiers: [
        { label: "7분56초 이하", maxValue: 476, score: 10 },
        { label: "8분06초 이하", maxValue: 486, score: 9 },
        { label: "8분16초 이하", maxValue: 496, score: 8 },
        { label: "8분26초 이하", maxValue: 506, score: 7 },
        { label: "8분36초 이하", maxValue: 516, score: 6 },
        { label: "8분46초 이하", maxValue: 526, score: 5 },
        { label: "8분56초 이하", maxValue: 536, score: 4 },
        { label: "8분56초 초과", maxValue: 99999, score: 1 },
      ],
      unit: "초",
      direction: "lower_better",
    },
  ],
  quality: [
    {
      // QA 평가 — 목표 87점, 2점 간격 8단계 (실제: 기준서 89→87)
      id: "qa_score",
      name: "QA 평가",
      category: "품질",
      maxScore: 15,
      tiers: [
        { label: "87점 이상", minValue: 87, score: 15 },
        { label: "85점 초과", minValue: 85, score: 13 },
        { label: "83점 초과", minValue: 83, score: 11 },
        { label: "81점 초과", minValue: 81, score: 9 },
        { label: "79점 초과", minValue: 79, score: 7 },
        { label: "77점 초과", minValue: 77, score: 5 },
        { label: "75점 초과", minValue: 75, score: 3 },
        { label: "75점 이하", minValue: 0, score: 1 },
      ],
      unit: "점",
      direction: "higher_better",
    },
    {
      // 상담평점 — 목표 4.8점, 0.1점 간격 8단계 (실제: 기준서 4.85→4.8)
      id: "csat_score",
      name: "상담평점",
      category: "품질",
      maxScore: 15,
      tiers: [
        { label: "4.8점 이상", minValue: 4.8, score: 15 },
        { label: "4.7점 초과", minValue: 4.7, score: 13 },
        { label: "4.6점 초과", minValue: 4.6, score: 11 },
        { label: "4.5점 초과", minValue: 4.5, score: 9 },
        { label: "4.4점 초과", minValue: 4.4, score: 7 },
        { label: "4.3점 초과", minValue: 4.3, score: 5 },
        { label: "4.2점 초과", minValue: 4.2, score: 3 },
        { label: "4.2점 이하", minValue: 0, score: 1 },
      ],
      unit: "점",
      direction: "higher_better",
    },
    {
      // 직무테스트 — 목표 90점, 2점 간격 5단계
      id: "quiz_score",
      name: "직무테스트",
      category: "품질",
      maxScore: 10,
      tiers: [
        { label: "90점 이상", minValue: 90, score: 10 },
        { label: "88점 초과", minValue: 88, score: 8 },
        { label: "86점 초과", minValue: 86, score: 6 },
        { label: "84점 초과", minValue: 84, score: 4 },
        { label: "84점 이하", minValue: 0, score: 2 },
      ],
      unit: "점",
      direction: "higher_better",
    },
  ],
  personnel: [
    {
      // 상담사 퇴사율 — 목표 5%, 1% 간격 7단계 (용산과 동일)
      id: "turnover_rate",
      name: "상담사 퇴사율",
      category: "인력관리",
      maxScore: 7,
      tiers: [
        { label: "5% 미만", maxValue: 5, score: 7 },
        { label: "6% 미만", maxValue: 6, score: 6 },
        { label: "7% 미만", maxValue: 7, score: 5 },
        { label: "8% 미만", maxValue: 8, score: 4 },
        { label: "9% 미만", maxValue: 9, score: 3 },
        { label: "10% 미만", maxValue: 10, score: 2 },
        { label: "10% 이상", maxValue: 99999, score: 1 },
      ],
      unit: "%",
      direction: "lower_better",
    },
  ],
  deductions: [],
  // 가감점 정의 (런타임에 실제 값 전달):
  // - 관리자 퇴사: 미퇴사 +1 / 1년미만 -1 / 1년이상 -2
  // - 오처리(대외민원): 건당 -1점
  // - 오처리(매니저확인): 건당 -0.1점 (용산은 -0.5점)
  // - 보안점검: 건당 -2점
}

// ============================================================
// 설정 조회
// ============================================================

const SLA_CONFIGS: Record<CenterName, SLAConfig> = {
  "용산": YONGSAN_CONFIG,
  "광주": GWANGJU_CONFIG,
}

export function getSLAConfig(center: CenterName): SLAConfig {
  return SLA_CONFIGS[center]
}

export function getAllSLAConfigs(): SLAConfig[] {
  return Object.values(SLA_CONFIGS)
}

// ============================================================
// SLA 점수 산정 로직
// ============================================================

/** 구간 매칭하여 점수 산정 */
function matchTier(metric: SLAMetric, actualValue: number): number {
  if (metric.direction === "higher_better") {
    // 높을수록 좋음 (응대율, QA, CSAT, Quiz) → minValue 기준 내림차순 탐색
    for (const tier of metric.tiers) {
      if (tier.minValue !== undefined && actualValue >= tier.minValue) {
        return tier.score
      }
    }
  } else {
    // 낮을수록 좋음 (처리시간, 퇴사율) → maxValue 기준 오름차순 탐색
    for (const tier of metric.tiers) {
      if (tier.maxValue !== undefined && actualValue <= tier.maxValue) {
        return tier.score
      }
    }
  }
  // fallback: 최저 점수
  return metric.tiers[metric.tiers.length - 1]?.score ?? 0
}

/** SLA 점수 산정 */
export function calculateSLA(
  config: SLAConfig,
  actualValues: Record<string, number>,
  deductions: SLADeduction[] = [],
): SLAResult {
  const details: SLAScoreDetail[] = []
  let productivityScore = 0
  let qualityScore = 0
  let personnelScore = 0

  // 생산성 항목
  for (const metric of config.productivity) {
    const actual = actualValues[metric.id] ?? 0
    const score = matchTier(metric, actual)
    productivityScore += score
    details.push({
      metricId: metric.id,
      name: metric.name,
      category: "생산성",
      maxScore: metric.maxScore,
      actualValue: actual,
      score,
      unit: metric.unit,
      achievementRate: metric.maxScore > 0 ? Math.round((score / metric.maxScore) * 100) : 0,
      direction: metric.direction,
    })
  }

  // 품질 항목
  for (const metric of config.quality) {
    const actual = actualValues[metric.id] ?? 0
    const score = matchTier(metric, actual)
    qualityScore += score
    details.push({
      metricId: metric.id,
      name: metric.name,
      category: "품질",
      maxScore: metric.maxScore,
      actualValue: actual,
      score,
      unit: metric.unit,
      achievementRate: metric.maxScore > 0 ? Math.round((score / metric.maxScore) * 100) : 0,
      direction: metric.direction,
    })
  }

  // 인력관리 항목 (상담사 퇴사율 등) — 명시적으로 전달된 경우만 반영
  for (const metric of config.personnel) {
    if (!(metric.id in actualValues)) continue // 데이터 미전달 시 제외
    const actual = actualValues[metric.id] ?? 0
    const score = matchTier(metric, actual)
    personnelScore += score
    details.push({
      metricId: metric.id,
      name: metric.name,
      category: "인력관리",
      maxScore: metric.maxScore,
      actualValue: actual,
      score,
      unit: metric.unit,
      achievementRate: metric.maxScore > 0 ? Math.round((score / metric.maxScore) * 100) : 0,
      direction: metric.direction,
    })
  }

  // 가감점 (관리자 퇴사, 오처리, 보안 등)
  const deductionScore = deductions.reduce((sum, d) => sum + d.score, 0)

  const totalScore = productivityScore + qualityScore + personnelScore + deductionScore
  const { grade, rate } = getGrade(totalScore)

  return {
    center: config.center,
    month: "",
    productivityScore,
    qualityScore,
    personnelScore,
    deductionScore,
    totalScore,
    grade,
    rate,
    details,
    deductions,
  }
}
