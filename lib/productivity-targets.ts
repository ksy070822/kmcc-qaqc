// 생산성 목표 설정 (2026년 기준)

export const PRODUCTIVITY_TARGETS = {
  voice: {
    responseRate: 85, // %
    handling: {
      택시: 185,
      대리: 185,
      퀵: 200,
      "퀵/배송": 200,
    } as Record<string, number>, // 초
  },
  chat: {
    responseRate: 90, // %
    waitTime: 120, // 초 (2분)
    handling: {
      택시: 500,
      대리: 492,
      퀵: 1770,
      "퀵/배송": 1770,
    } as Record<string, number>, // 초
  },
}

/** 정렬 순서 */
export const CENTER_SORT_ORDER = ["용산", "광주"]
export const VERTICAL_SORT_ORDER = ["택시", "대리", "퀵/배송", "바이크", "주차"]

/** 센터+버티컬 정렬 비교 함수 */
export function sortCenterVertical<T extends { center: string; vertical: string }>(a: T, b: T): number {
  const ci = CENTER_SORT_ORDER.indexOf(a.center)
  const cj = CENTER_SORT_ORDER.indexOf(b.center)
  const cDiff = (ci === -1 ? 999 : ci) - (cj === -1 ? 999 : cj)
  if (cDiff !== 0) return cDiff
  const vi = VERTICAL_SORT_ORDER.indexOf(a.vertical)
  const vj = VERTICAL_SORT_ORDER.indexOf(b.vertical)
  return (vi === -1 ? 999 : vi) - (vj === -1 ? 999 : vj)
}

/** 센터별 유효 버티컬 (용산은 바이크/주차 그룹 없음) */
export const CENTER_VERTICALS: Record<string, string[]> = {
  용산: ["택시", "대리", "퀵/배송"],
  광주: ["택시", "대리", "퀵/배송", "바이크", "주차"],
}

/** 센터-버티컬 조합이 유효한지 확인 */
export function isValidCenterVertical(center: string, vertical: string): boolean {
  const allowed = CENTER_VERTICALS[center]
  if (!allowed) return true // 알 수 없는 센터는 통과
  return allowed.includes(vertical)
}

/** 목표 대비 달성 여부 판정 */
export function isTargetMet(actual: number, target: number, direction: "higher" | "lower"): boolean {
  return direction === "higher" ? actual >= target : actual <= target
}
