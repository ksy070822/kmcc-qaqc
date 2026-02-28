/**
 * KMCC QC 대시보드 상수 정의
 * 평가 항목, 센터/서비스/채널/근속 구분 등
 * 컴포넌트에서 공통으로 사용하는 상수
 */
import type { EvaluationItem } from "./types"

// ============================================================
// P2-17: QC 오류율 공식 항목 수
// 상담태도 오류율 = 태도오류건수 / (검수건수 × QC_ATTITUDE_ITEM_COUNT) × 100
// 오상담 오류율   = 오상담오류건수 / (검수건수 × QC_CONSULTATION_ITEM_COUNT) × 100
// ============================================================
/** 상담태도 항목 수 (첫인사/끝인사, 공감표현, 사과표현, 추가문의, 불친절) */
export const QC_ATTITUDE_ITEM_COUNT = 5
/** 오상담/오처리 항목 수 */
export const QC_CONSULTATION_ITEM_COUNT = 11
/** 전체 QC 항목 수 (태도 + 오상담) */
export const QC_TOTAL_ITEM_COUNT = QC_ATTITUDE_ITEM_COUNT + QC_CONSULTATION_ITEM_COUNT // 16

// ============================================================
// P2-17: 센터 목표율 (2026년 기준)
// ============================================================
export const CENTER_TARGET_RATES = {
  용산: { attitude: 3.3, ops: 3.9 },
  광주: { attitude: 2.7, ops: 1.7 },
  전체: { attitude: 3.0, ops: 3.0 },
} as const

/** 센터별 QC 목표치를 반환하는 헬퍼 (기존 getCenterTargets 함수 대체) */
export function getCenterQCTargets(center: string): { att: number; ops: number } {
  if (center === "용산") return { att: CENTER_TARGET_RATES.용산.attitude, ops: CENTER_TARGET_RATES.용산.ops }
  if (center === "광주") return { att: CENTER_TARGET_RATES.광주.attitude, ops: CENTER_TARGET_RATES.광주.ops }
  return { att: CENTER_TARGET_RATES.전체.attitude, ops: CENTER_TARGET_RATES.전체.ops }
}

// ============================================================
// P2-17: 목표 달성 판정 배수 (goal status 판정용)
// ============================================================
/** 목표의 90% 이하이면 "달성" */
export const GOAL_ACHIEVED_MULTIPLIER = 0.9
/** 목표의 110% 초과이면 "미달" */
export const GOAL_MISSED_MULTIPLIER = 1.1

// ============================================================
// P2-17: 센터 순서 (UI 렌더링 순서)
// ============================================================
export const CENTER_ORDER = ["용산", "광주"] as const

// ============================================================
// P2-17: UX 임계값
// ============================================================
/** 주 초반 판단 일수 — 목~토(0~2일차)이면 이전 주차 선택 */
export const WEEK_EARLY_DAYS_THRESHOLD = 3
/** 트렌드 차트 일별 표시 일수 */
export const TREND_CHART_DAYS = 14
/** 주간 트렌드 표시 주수 */
export const WEEKLY_TREND_WEEKS = 6
/** 월 선택 드롭다운 개월 수 */
export const MONTH_SELECTOR_COUNT = 6

// ============================================================
// P2-18: QC 평가항목 16개 매핑 (태도 5 + 오상담 11)
// 기존 evaluationItems(BQ 컬럼 매핑)과 별도로,
// 코칭·분석 UI에서 사용하는 간결한 key/label 매핑
// ============================================================
export const QC_ATTITUDE_ITEMS = [
  { key: "greeting", label: "인사/종결어", columnKey: "첫인사끝인사누락" },
  { key: "empathy", label: "공감표현", columnKey: "공감표현누락" },
  { key: "apology", label: "사과표현", columnKey: "사과표현누락" },
  { key: "additional", label: "추가문의", columnKey: "추가문의누락" },
  { key: "unkind", label: "불친절", columnKey: "불친절" },
] as const

export const QC_CONSULTATION_ITEMS = [
  { key: "consult_type", label: "상담유형 오설정", columnKey: "상담유형오설정" },
  { key: "guide", label: "가이드 미준수", columnKey: "가이드미준수" },
  { key: "identity", label: "본인확인 누락", columnKey: "본인확인누락" },
  { key: "search", label: "필수탐색 누락", columnKey: "필수탐색누락" },
  { key: "wrong_guide", label: "오안내", columnKey: "오안내" },
  { key: "process_missing", label: "전산 처리 누락", columnKey: "전산처리누락" },
  { key: "process_incomplete", label: "전산 처리 미흡/정정", columnKey: "전산처리미흡정정" },
  { key: "system_error", label: "전산 조작 미흡/오류", columnKey: "전산조작미흡오류" },
  { key: "id_mapping", label: "ID매핑 누락/오기재", columnKey: "콜픽트립ID매핑누락오기재" },
  { key: "flag_keyword", label: "플래그/키워드 누락/오기재", columnKey: "플래그키워드누락오기재" },
  { key: "history", label: "상담이력 기재 미흡", columnKey: "상담이력기재미흡" },
] as const

/** 전체 QC 항목 (태도 + 오상담) */
export const QC_ALL_ITEMS = [...QC_ATTITUDE_ITEMS, ...QC_CONSULTATION_ITEMS] as const

// 평가항목 16개 (로우데이터 컬럼과 매핑)
export const evaluationItems: EvaluationItem[] = [
  // 상담태도 (5개)
  {
    id: "att1",
    category: "상담태도",
    name: "첫인사/끝인사 누락",
    shortName: "첫인사/끝인사",
    columnKey: "첫인사끝인사누락",
  },
  { id: "att2", category: "상담태도", name: "공감표현 누락", shortName: "공감표현", columnKey: "공감표현누락" },
  { id: "att3", category: "상담태도", name: "사과표현 누락", shortName: "사과표현", columnKey: "사과표현누락" },
  { id: "att4", category: "상담태도", name: "추가문의 누락", shortName: "추가문의", columnKey: "추가문의누락" },
  { id: "att5", category: "상담태도", name: "불친절", shortName: "불친절", columnKey: "불친절" },
  // 오상담/오처리 (11개)
  {
    id: "err1",
    category: "오상담/오처리",
    name: "상담유형 오설정",
    shortName: "상담유형 오설정",
    columnKey: "상담유형오설정",
  },
  {
    id: "err2",
    category: "오상담/오처리",
    name: "가이드 미준수",
    shortName: "가이드 미준수",
    columnKey: "가이드미준수",
  },
  {
    id: "err3",
    category: "오상담/오처리",
    name: "본인확인 누락",
    shortName: "본인확인 누락",
    columnKey: "본인확인누락",
  },
  {
    id: "err4",
    category: "오상담/오처리",
    name: "필수탐색 누락",
    shortName: "필수탐색 누락",
    columnKey: "필수탐색누락",
  },
  { id: "err5", category: "오상담/오처리", name: "오안내", shortName: "오안내", columnKey: "오안내" },
  {
    id: "err6",
    category: "오상담/오처리",
    name: "전산 처리 누락",
    shortName: "전산처리 누락",
    columnKey: "전산처리누락",
  },
  {
    id: "err7",
    category: "오상담/오처리",
    name: "전산 처리 미흡/정정",
    shortName: "전산처리 미흡",
    columnKey: "전산처리미흡정정",
  },
  {
    id: "err8",
    category: "오상담/오처리",
    name: "전산 조작 미흡/오류",
    shortName: "전산조작 오류",
    columnKey: "전산조작미흡오류",
  },
  {
    id: "err9",
    category: "오상담/오처리",
    name: "콜/픽/트립ID 매핑누락&오기재",
    shortName: "ID매핑 누락",
    columnKey: "콜픽트립ID매핑누락오기재",
  },
  {
    id: "err10",
    category: "오상담/오처리",
    name: "플래그/키워드 누락&오기재",
    shortName: "플래그/키워드",
    columnKey: "플래그키워드누락오기재",
  },
  {
    id: "err11",
    category: "오상담/오처리",
    name: "상담이력 기재 미흡",
    shortName: "상담이력 미흡",
    columnKey: "상담이력기재미흡",
  },
]

// 서비스 정렬 순서 (센터비교 표에서 항상 이 순서)
export const SERVICE_ORDER = ["택시", "대리", "배송", "바이크/마스", "주차/카오너", "화물", "심야"] as const

// 서비스명 정규화 맵 (BQ 원본 / 변형 → 표준 표시명)
export const SERVICE_NORMALIZE_MAP: Record<string, string> = {
  // 배송 변형
  "퀵": "배송",
  "퀵배송": "배송",
  "퀵·배송": "배송",
  "도보배송": "배송",
  "한차배송": "배송",
  // 택시 변형
  "심사": "택시",
  // 바이크/마스 변형 (1depth 언더바 앞 추출 결과)
  "바이크": "바이크/마스",
  "마스": "바이크/마스",
  "MaaS": "바이크/마스",
  "바이크&MaaS": "바이크/마스",
  "바이크/MaaS": "바이크/마스",
  // 주차/카오너 변형
  "주차": "주차/카오너",
  "카오너": "주차/카오너",
  "주차/카오너 채팅": "주차/카오너",
  "주차&카오너": "주차/카오너",
  // combined service+channel 폴백 (BQ 미마이그레이션분)
  "택시 / 유선": "택시",
  "택시 / 채팅": "택시",
  "대리 / 유선": "대리",
  "대리 / 채팅": "대리",
  "주차&카오너 / 채팅": "주차/카오너",
  "주차&카오너 / 유선": "주차/카오너",
  "바이크&MaaS / 채팅": "바이크/마스",
  "바이크&MaaS / 유선": "바이크/마스",
}

// combined service+channel → 채널 추출 (service 필드에 채널이 포함된 경우)
export const SERVICE_CHANNEL_EXTRACT: Record<string, string> = {
  "택시 / 유선": "유선",
  "택시 / 채팅": "채팅",
  "대리 / 유선": "유선",
  "대리 / 채팅": "채팅",
  "주차&카오너 / 채팅": "채팅",
  "주차&카오너 / 유선": "유선",
  "바이크&MaaS / 채팅": "채팅",
  "바이크&MaaS / 유선": "유선",
}

// 유효 채널 (이 외의 값은 센터비교에서 제외: 게시판/보드, 팀장, 모니터링, QC 등)
export const VALID_CHANNELS = ["유선", "채팅"] as const

// 잘못된 서비스명 (필터링/폴백 대상)
export const INVALID_SERVICE_NAMES = ["파트너가이드", "카카오 T", "카카오T", "#VALUE!", "", "지금여기", "Staff"]

// 서비스명 표시 매핑 (BQ 원본 → 화면 표시명)
export function displayServiceName(rawName: string, center?: string): string {
  if (!rawName) return rawName
  return SERVICE_NORMALIZE_MAP[rawName] || rawName
}

// 그룹 = 서비스 + 채널 조합
export const groups = {
  용산: ["택시/유선", "택시/채팅", "배송/유선", "배송/채팅"],
  광주: [
    "택시/유선",
    "택시/채팅",
    "대리/유선",
    "대리/채팅",
    "배송/유선",
    "배송/채팅",
    "바이크/마스/유선",
    "바이크/마스/채팅",
    "주차/카오너/유선",
    "주차/카오너/채팅",
    "화물/유선",
    "화물/채팅",
    "심야",
  ],
}

export const serviceGroups = {
  용산: ["택시", "배송"] as const,
  광주: ["택시", "대리", "배송", "바이크/마스", "주차/카오너", "화물", "심야"] as const,
} as const

export const channelTypes = ["유선", "채팅"] as const

// 근속기간 구분
export const tenureCategories = ["3개월 미만", "3개월 이상", "6개월 이상", "12개월 이상"] as const
export const tenures = tenureCategories

export const getTenureCategory = (months: number): string => {
  if (months < 3) return "3개월 미만"
  if (months < 6) return "3개월 이상"
  if (months < 12) return "6개월 이상"
  return "12개월 이상"
}

// ============================================================
// QA(품질보증) 평가항목 상수
// ============================================================

import type { QAEvaluationItem } from "./types"

// QA 평가항목 (유선+채팅 통합, channelScope로 구분)
export const QA_EVALUATION_ITEMS: QAEvaluationItem[] = [
  // 공통 항목
  { id: "qa_greeting", category: "공통", name: "인사예절", shortName: "인사", columnKey: "greetingScore", maxScore: 6, channelScope: "all" },
  { id: "qa_response", category: "공통", name: "화답표현", shortName: "화답", columnKey: "responseExpression", maxScore: 5, channelScope: "all" },
  { id: "qa_inquiry", category: "공통", name: "문의내용파악", shortName: "문의파악", columnKey: "inquiryComprehension", maxScore: 5, channelScope: "all" },
  { id: "qa_identity", category: "공통", name: "본인확인", shortName: "본인확인", columnKey: "identityCheck", maxScore: 5, channelScope: "all" },
  { id: "qa_search", category: "공통", name: "필수탐색", shortName: "필수탐색", columnKey: "requiredSearch", maxScore: 5, channelScope: "all" },
  { id: "qa_knowledge", category: "공통", name: "업무지식", shortName: "업무지식", columnKey: "businessKnowledge", maxScore: 15, channelScope: "all" },
  { id: "qa_promptness", category: "공통", name: "신속성", shortName: "신속성", columnKey: "promptness", maxScore: 3, channelScope: "all" },
  { id: "qa_system", category: "공통", name: "전산처리", shortName: "전산처리", columnKey: "systemProcessing", maxScore: 6, channelScope: "all" },
  { id: "qa_history", category: "공통", name: "상담이력", shortName: "상담이력", columnKey: "consultationHistory", maxScore: 5, channelScope: "all" },
  { id: "qa_empathy", category: "공통", name: "감성케어", shortName: "감성케어", columnKey: "empathyCare", maxScore: 17, channelScope: "all" },
  { id: "qa_language", category: "공통", name: "언어표현", shortName: "언어표현", columnKey: "languageExpression", maxScore: 5, channelScope: "all" },
  { id: "qa_listening", category: "공통", name: "경청/집중태도", shortName: "경청", columnKey: "listeningFocus", maxScore: 5, channelScope: "all" },
  { id: "qa_explain", category: "공통", name: "설명능력", shortName: "설명능력", columnKey: "explanationAbility", maxScore: 5, channelScope: "all" },
  { id: "qa_satisfaction", category: "공통", name: "체감만족", shortName: "체감만족", columnKey: "perceivedSatisfaction", maxScore: 3, channelScope: "all" },
  { id: "qa_praise", category: "공통", name: "칭찬접수", shortName: "칭찬", columnKey: "praiseBonus", maxScore: 10, channelScope: "all" },
  // 유선 전용
  { id: "qa_voice", category: "유선전용", name: "음성연출", shortName: "음성연출", columnKey: "voicePerformance", maxScore: 8, channelScope: "voice" },
  { id: "qa_speech", category: "유선전용", name: "말속도/발음", shortName: "말속도", columnKey: "speechSpeed", maxScore: 2, channelScope: "voice" },
  { id: "qa_honorific", category: "유선전용", name: "호칭오류", shortName: "호칭오류", columnKey: "honorificError", maxScore: -1, channelScope: "voice" },
  // 채팅 전용
  { id: "qa_spelling", category: "채팅전용", name: "맞춤법", shortName: "맞춤법", columnKey: "spelling", maxScore: 5, channelScope: "chat" },
  { id: "qa_close", category: "채팅전용", name: "종료요청", shortName: "종료요청", columnKey: "closeRequest", maxScore: 3, channelScope: "chat" },
  { id: "qa_copy_err", category: "채팅전용", name: "복사오류", shortName: "복사오류", columnKey: "copyError", maxScore: -1, channelScope: "chat" },
  { id: "qa_op_err", category: "채팅전용", name: "조작오류", shortName: "조작오류", columnKey: "operationError", maxScore: -1, channelScope: "chat" },
]

// 채널별 필터링 헬퍼
export const QA_COMMON_ITEMS = QA_EVALUATION_ITEMS.filter(i => i.channelScope === "all")
export const QA_VOICE_ONLY_ITEMS = QA_EVALUATION_ITEMS.filter(i => i.channelScope === "voice")
export const QA_CHAT_ONLY_ITEMS = QA_EVALUATION_ITEMS.filter(i => i.channelScope === "chat")

// QA 채널별 만점 기준
export const QA_VOICE_TOTAL = 100 // 유선 만점
export const QA_CHAT_TOTAL = 100  // 채팅 만점

// QA 점수 등급 구간
export const QA_SCORE_GRADES = [
  { label: "우수", min: 92, color: "#22c55e" },
  { label: "양호", min: 90, color: "#3b82f6" },
  { label: "보통", min: 88, color: "#f59e0b" },
  { label: "미흡", min: 85, color: "#f97316" },
  { label: "부진", min: 0, color: "#ef4444" },
] as const

export function getQAScoreGrade(score: number): typeof QA_SCORE_GRADES[number] {
  return QA_SCORE_GRADES.find(g => score >= g.min) || QA_SCORE_GRADES[QA_SCORE_GRADES.length - 1]
}

// ============================================================
// 상담평점 상수
// ============================================================

// 상담평점 점수 분포 색상
export const CSAT_SCORE_COLORS: Record<number, string> = {
  5: "#22c55e",
  4: "#3b82f6",
  3: "#f59e0b",
  2: "#f97316",
  1: "#ef4444",
}

// 상담평점 목표 평점 (전체)
export const CSAT_TARGET_SCORE = 4.70

// 상담평점 서비스별 목표 평점
export const CSAT_SERVICE_TARGETS: Record<string, number> = {
  "택시": 4.53,
  "바이크": 4.90,
  "주차": 4.87,
  "대리": 4.51,
  "퀵": 4.43,
}

// 상담평점 태그 한글 매핑
export const CSAT_TAG_LABELS: Record<string, string> = {
  FAST: "빠른 상담 연결",
  EASY: "알기쉬운 설명",
  EXACT: "정확한 문의파악",
  KIND: "친절한 상담",
  ACTIVE: "적극적인 상담",
  WAIT: "상담 연결 지연",
  DIFFICULT: "어려운 설명",
  INEXACT: "문의내용 이해못함",
  UNKIND: "불친절한 상담",
  PASSIVE: "형식적인 상담",
  ETC: "기타",
}

// ============================================================
// 통합 리스크 가중치
// ============================================================

export const RISK_WEIGHTS = {
  qa: 0.30,     // QA 점수 (30%)
  qc: 0.30,     // QC 오류율 (30%)
  csat: 0.25,   // 상담평점 (25%)
  knowledge: 0.15, // 직무테스트 (15%)
} as const

export const RISK_THRESHOLDS = {
  low: 30,
  medium: 30,
  high: 50,
  critical: 70,
} as const

// 리스크 레벨 UI 설정
export const RISK_LEVEL_CONFIG = {
  low:      { label: "양호", color: "#22c55e" },
  medium:   { label: "주의", color: "#f59e0b" },
  high:     { label: "위험", color: "#f97316" },
  critical: { label: "심각", color: "#ef4444" },
} as const

// 도메인 라벨
export const DOMAIN_LABELS: Record<string, string> = {
  qa: "QA (SLA)",
  qc: "QC",
  csat: "상담평점",
  quiz: "직무테스트",
}

// QC 오류율 정규화 상한 (20% → 100점 환산)
export const QC_RATE_CAP = 20

// ============================================================
// 코칭 시스템 상수
// ============================================================

import type {
  CoachingCategoryDef,
  CoachingCategoryId,
  CoachingTierConfig,
  TenureBand,
  ChannelRiskWeights,
  ChannelRiskWeightsV3,
} from "./types"

// 8개 코칭 카테고리 매핑 (QC 오류항목 ↔ QA 채점항목)
export const COACHING_CATEGORIES: CoachingCategoryDef[] = [
  {
    id: 'greeting',
    label: '인사/예절',
    qcItems: ['첫인사끝인사누락', '추가문의누락'],
    qaItems: ['greetingScore'],
    qcWeight: 0.6,
    qaWeight: 0.4,
  },
  {
    id: 'empathy',
    label: '공감/감성케어',
    qcItems: ['공감표현누락', '사과표현누락', '불친절'],
    qaItems: ['empathyCare', 'listeningFocus', 'responseExpression'],
    qcWeight: 0.5,
    qaWeight: 0.5,
  },
  {
    id: 'inquiry',
    label: '문의파악/탐색',
    qcItems: ['본인확인누락', '필수탐색누락'],
    qaItems: ['identityCheck', 'requiredSearch', 'inquiryComprehension'],
    qcWeight: 0.5,
    qaWeight: 0.5,
  },
  {
    id: 'knowledge',
    label: '업무지식/안내',
    qcItems: ['오안내', '가이드미준수'],
    qaItems: ['businessKnowledge', 'explanationAbility'],
    qcWeight: 0.4,
    qaWeight: 0.4,
    otherWeight: 0.2,
    otherSource: 'quiz',
  },
  {
    id: 'processing',
    label: '전산처리',
    qcItems: ['전산처리누락', '전산처리미흡정정', '전산조작미흡오류', '콜픽트립ID매핑누락오기재'],
    qaItems: ['systemProcessing'],
    qcWeight: 0.6,
    qaWeight: 0.4,
  },
  {
    id: 'records',
    label: '이력/기록관리',
    qcItems: ['상담이력기재미흡', '플래그키워드누락오기재', '상담유형오설정'],
    qaItems: ['consultationHistory'],
    qcWeight: 0.6,
    qaWeight: 0.4,
  },
  {
    id: 'satisfaction',
    label: '체감만족/신속성',
    qcItems: [],
    qaItems: ['perceivedSatisfaction', 'promptness'],
    qcWeight: 0,
    qaWeight: 0.6,
    otherWeight: 0.4,
    otherSource: 'csat',
  },
  {
    id: 'communication',
    label: '의사소통',
    qcItems: [],
    qaItems: ['languageExpression', 'voicePerformance', 'spelling'],
    qcWeight: 0,
    qaWeight: 1.0,
  },
]

// 카테고리 빠른 조회용 맵
export const COACHING_CATEGORY_MAP: Record<CoachingCategoryId, CoachingCategoryDef> =
  Object.fromEntries(COACHING_CATEGORIES.map(c => [c.id, c])) as Record<CoachingCategoryId, CoachingCategoryDef>

// QC 오류 columnKey → 코칭 카테고리 역매핑
export const QC_ERROR_TO_CATEGORY: Record<string, CoachingCategoryId> = {}
for (const cat of COACHING_CATEGORIES) {
  for (const item of cat.qcItems) {
    QC_ERROR_TO_CATEGORY[item] = cat.id
  }
}

// 코칭 티어 설정
export const COACHING_TIERS: CoachingTierConfig[] = [
  { tier: '일반', minRisk: 0, maxRisk: 20, frequency: '자율' },
  { tier: '주의', minRisk: 20, maxRisk: 40, frequency: '월1회' },
  { tier: '위험', minRisk: 40, maxRisk: 60, frequency: '격주' },
  { tier: '심각', minRisk: 60, maxRisk: 80, frequency: '주1회' },
  { tier: '긴급', minRisk: 80, maxRisk: 100, frequency: '주2회' },
]

// 근속 구간 판정
export function getTenureBand(months: number): TenureBand {
  if (months < 2) return 'new_hire'
  if (months < 6) return 'early'
  if (months < 12) return 'standard'
  return 'experienced'
}

// 근속별 리스크 증폭 계수 (신입=강화 관리)
export const TENURE_RISK_MULTIPLIER: Record<TenureBand, number> = {
  new_hire: 1.2,      // <2개월: QC가 유일한 품질 신호, 관리 강도 상향
  early: 1.1,         // 2~6개월: 여전히 불안정
  standard: 1.0,      // 6~12개월: 기준
  experienced: 1.05,  // 12개월+: 높은 기대치, 부진 시 더 심각
}

// 채널별 리스크 가중치 (일반)
export const RISK_WEIGHTS_V2: Record<'voice' | 'chat', ChannelRiskWeights> = {
  voice: { qa: 0.45, qc: 0.35, csat: 0.00, quiz: 0.20 },
  chat:  { qa: 0.35, qc: 0.25, csat: 0.20, quiz: 0.20 },
}

// 신입 전용 가중치 (<2개월, 직무테스트 제외)
export const RISK_WEIGHTS_NEW_HIRE: Record<'voice' | 'chat', ChannelRiskWeights> = {
  voice: { qa: 0.50, qc: 0.50, csat: 0.00, quiz: 0.00 },
  chat:  { qa: 0.40, qc: 0.35, csat: 0.25, quiz: 0.00 },
}

// 데이터 커버리지 댐프닝 (활성 도메인 수 → 리스크 상한 계수)
// 1개 도메인만 있으면 최대 50점, 4개 모두 있으면 100점까지 가능
export const COVERAGE_DAMPENING: Record<number, number> = {
  1: 0.50,
  2: 0.70,
  3: 0.90,
  4: 1.00,
}

// ============================================================
// 7도메인 리스크 가중치 (Pulse 2)
// 기존 4도메인(RISK_WEIGHTS_V2) 비율 유지 + 생산성/근태/SLA 신규 추가, 재정규화
// ============================================================

// 7도메인 채널별 리스크 가중치 (standard + new_hire 통합)
export const RISK_WEIGHTS_V3: Record<'voice' | 'chat', {
  standard: ChannelRiskWeightsV3
  new_hire: ChannelRiskWeightsV3
}> = {
  voice: {
    standard: { qa: 0.35, qc: 0.25, csat: 0.00, quiz: 0.15, productivity: 0.12, attendance: 0.05, sla: 0.08 },
    new_hire: { qa: 0.40, qc: 0.40, csat: 0.00, quiz: 0.00, productivity: 0.12, attendance: 0.05, sla: 0.03 },
  },
  chat: {
    standard: { qa: 0.25, qc: 0.18, csat: 0.15, quiz: 0.15, productivity: 0.12, attendance: 0.05, sla: 0.10 },
    new_hire: { qa: 0.30, qc: 0.22, csat: 0.23, quiz: 0.00, productivity: 0.12, attendance: 0.05, sla: 0.08 },
  },
} as const

// 7도메인 커버리지 감쇄 (Pulse 2)
// 활성 도메인 수 → 리스크 상한 계수 (1~7)
export const COVERAGE_DAMPENING_V2: Record<number, number> = {
  1: 0.35, 2: 0.50, 3: 0.65, 4: 0.80, 5: 0.90, 6: 0.95, 7: 1.00,
}

// 7도메인 부진 판정 기준 (Pulse 2)
export const UNDERPERFORMING_THRESHOLDS_V2 = {
  qc_attitude:  { underperforming: 1.5, severe: 2.5, exempt_min_evals: 5 },   // 목표 대비 배수
  qc_misconsult: { underperforming: 1.5, severe: 2.5, exempt_min_evals: 5 },
  qa:           { underperforming: 85, severe: 80, exempt_tenure_months: 1 },   // 점수 미만
  csat:         { underperforming: 3.5, severe: 3.0, exempt_min_reviews: 10 },
  quiz:         { underperforming: 70, severe: 60, exempt_current_month: true },
  productivity: { underperforming: 80, severe: 70, exempt_tenure_weeks: 2 },    // 응답률 %
  attendance:   { underperforming: 90, severe: 80, exempt_approved_leave: true },
} as const

// 베이지안 축소 파라미터
export const BAYESIAN_CONFIG = {
  minEvalsForHigh: 15,     // 고신뢰
  minEvalsForModerate: 5,  // 중신뢰
  // shrinkage: adjustedRate = (n * rawRate + k * priorRate) / (n + k)
  shrinkageStrength: 5,    // k: 사전분포 가중치
}

// 추세 분석 설정
export const TREND_CONFIG = {
  minWeeks: 3,             // 최소 분석 기간
  decayFactor: 0.85,       // 지수 감쇠 (최근 데이터 가중)
  significanceLevel: 0.10, // p-value 임계값
}

// 경보 임계값
export const ALERT_THRESHOLDS = {
  deterioration: 0.50,     // 주간 오류율 전주 대비 50%↑
  csatDrop: 0.3,           // 상담평점 주간평균 0.3점↓
  noImprovementWeeks: 2,   // 미개선 판정 주수
  coachingOverdueDays: 3,  // 코칭 미실시 일수
  cohortDelayWeeks: 2,     // 코호트 평균 대비 지연 주수
}

// 근속별 리포트 유형
export type ReportCadence = 'daily' | 'weekly' | 'monthly'

// 주간 리포트 주차별 구성
export type WeeklyReportPhase = 'month_start' | 'week2' | 'week3' | 'month_end'

export const WEEKLY_REPORT_PHASES: Record<WeeklyReportPhase, { label: string; focus: string }> = {
  month_start: { label: '월초 (1주차)', focus: '전월 평가 기반 이번달 개선 포인트' },
  week2:       { label: '2주차', focus: '활동계획 대비 실제 성과 점검' },
  week3:       { label: '3주차', focus: '활동계획 대비 성과 추적 + 중간 보정' },
  month_end:   { label: '월말 (4주차)', focus: '위험도 예측 + 월말 전망' },
}

// 근속별 모니터링 정책
export const TENURE_MONITORING_POLICY: Record<TenureBand, {
  cadence: ReportCadence
  description: string
}> = {
  new_hire:    { cadence: 'daily',   description: '1개월 미만: 데일리 QC + 상담평점(채팅) 취약점 밀접 모니터링' },
  early:       { cadence: 'weekly',  description: '1~2개월: 부진 대상 1개월차 리포트 유지, 양호하면 주간 전환' },
  standard:    { cadence: 'weekly',  description: '3개월+: 주간(주차별 구성) + 월간 리포트' },
  experienced: { cadence: 'weekly',  description: '12개월+: 주간(주차별 구성) + 월간 리포트' },
}

// ============================================================
// 미흡상담사 관리 기준 (24.04.01~ 시행, 개요 시트 기준)
// ============================================================

import type { UnderperformingCriterionConfig, UnderperformingCriterionId } from "./types"

// 4개 선정 기준
export const UNDERPERFORMING_CRITERIA: UnderperformingCriterionConfig[] = [
  {
    id: 'qa_knowledge',
    label: 'QA 업무지식',
    category: 'QA',
    period: 'monthly',
    threshold: 7,
    direction: 'lte',           // ≤7점이면 적발
    minTenureMonths: 1,         // 투입 후 1개월 미만 제외
    resolution: {
      threshold: 7,             // M+1 ≥7점이면 해소
      nextMonth: true,
    },
  },
  {
    id: 'qc_attitude',
    label: 'QC 상담태도',
    category: 'QC',
    period: 'weekly',
    threshold: 15,
    direction: 'gte',           // ≥15%이면 적발
    minEvals: 10,               // QC검수 10건 이상
    resolution: {
      threshold: 15,            // ≤15%이면 해소
      consecutiveWeeks: 2,      // 2주 연속
    },
  },
  {
    id: 'qc_ops',
    label: 'QC 오상담/오처리',
    category: 'QC',
    period: 'weekly',
    threshold: 10,
    direction: 'gte',           // ≥10%이면 적발
    minEvals: 10,               // QC검수 10건 이상
    resolution: {
      threshold: 10,            // ≤10%이면 해소
      consecutiveWeeks: 2,      // 2주 연속
    },
  },
  {
    id: 'csat_low_score',
    label: '상담평가 저점(1·2점)',
    category: '상담평점',
    period: 'weekly',           // 주/월 모두 (주: ≥3건, 월: ≥12건)
    threshold: 3,               // 주 단위 기준
    direction: 'gte',           // ≥3건이면 적발
    resolution: {
      threshold: 3,             // 2주 연속 ≤3건
      consecutiveWeeks: 2,
      nextMonth: true,          // 또는 M+1 ≤12건
    },
  },
]

// 월 단위 기준값 (주 단위와 다른 항목)
export const UNDERPERFORMING_MONTHLY_THRESHOLDS: Partial<Record<UnderperformingCriterionId, number>> = {
  csat_low_score: 12,           // 월 ≥12건이면 적발 (주 ≥3건과 별도)
}

// 월 단위 해소 기준값
export const UNDERPERFORMING_MONTHLY_RESOLUTION: Partial<Record<UnderperformingCriterionId, number>> = {
  csat_low_score: 12,           // M+1 ≤12건이면 해소
}

// 저품질 상담사 판정 규칙
export const LOW_QUALITY_RULES = {
  consecutiveWeeksForLowQuality: 3,   // 3주 연속 적발 → 저품질
  simultaneousCriteriaForImmediate: 3, // 3개 항목 당월 동시 적발 → 즉시 저품질
  newHireExemptMonths: 3,             // 신입 전배/배제 유예 기간 (개월)
  actions: ['전배', '업무배제', '업무시간 변경'] as const,
}

// 미흡상담사 기준 빠른 조회용 맵
export const UNDERPERFORMING_CRITERIA_MAP: Record<UnderperformingCriterionId, UnderperformingCriterionConfig> =
  Object.fromEntries(UNDERPERFORMING_CRITERIA.map(c => [c.id, c])) as Record<UnderperformingCriterionId, UnderperformingCriterionConfig>
