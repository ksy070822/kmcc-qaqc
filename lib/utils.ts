import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 목~수 기준 주간 계산 유틸리티
 * 기준일이 속한 목~수 주를 반환합니다.
 */
export function getThursdayWeek(baseDate: Date) {
  const d = new Date(baseDate)
  const dayOfWeek = d.getDay()
  const daysBack = (dayOfWeek - 4 + 7) % 7
  const thursday = new Date(d)
  thursday.setDate(d.getDate() - daysBack)
  const wednesday = new Date(thursday)
  wednesday.setDate(thursday.getDate() + 6)
  return { start: thursday, end: wednesday }
}

/** 이전 주 목~수 구간 */
export function getPrevThursdayWeek(baseDate: Date) {
  const { start } = getThursdayWeek(baseDate)
  const prevThursday = new Date(start)
  prevThursday.setDate(start.getDate() - 7)
  return getThursdayWeek(prevThursday)
}

/** 목~수 주간 라벨 문자열 (ex: "2026-W07") */
export function getThursdayWeekLabel(baseDate: Date): string {
  const { start } = getThursdayWeek(baseDate)
  const yearStart = new Date(start.getFullYear(), 0, 1)
  const diff = start.getTime() - yearStart.getTime()
  const weekNum = Math.ceil((diff / 86400000 + yearStart.getDay() + 1) / 7)
  return `${start.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

/** 목~수 주간 날짜 범위 문자열 */
export function getThursdayWeekRange(baseDate: Date): { start: string; end: string; weekNum: number } {
  const { start, end } = getThursdayWeek(baseDate)
  const yearStart = new Date(start.getFullYear(), 0, 1)
  const diff = start.getTime() - yearStart.getTime()
  const weekNum = Math.ceil((diff / 86400000 + yearStart.getDay() + 1) / 7)
  return {
    start: format(start, 'MM/dd', { locale: ko }),
    end: format(end, 'MM/dd', { locale: ko }),
    weekNum,
  }
}

/** 날짜를 yyyy-MM-dd 형식으로 */
export function formatDate(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export interface StatusColors {
  bg: string
  text: string
  border: string
  badge: string
  level: 'achieved' | 'onTrack' | 'caution' | 'warning' | 'risk'
  label: string
}

/**
 * 확률에 따른 상태 색상 반환
 */
export function getStatusColorsByProbability(probability: number): StatusColors {
  if (probability >= 80) {
    return {
      bg: 'bg-green-500',
      text: 'text-green-600',
      border: 'border-green-400',
      badge: 'bg-green-50 text-green-700 border-green-200',
      level: 'achieved',
      label: '달성'
    }
  }
  if (probability >= 60) {
    return {
      bg: 'bg-blue-500',
      text: 'text-blue-600',
      border: 'border-blue-400',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      level: 'onTrack',
      label: '순항'
    }
  }
  if (probability >= 40) {
    return {
      bg: 'bg-yellow-500',
      text: 'text-yellow-600',
      border: 'border-yellow-400',
      badge: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      level: 'caution',
      label: '주의'
    }
  }
  if (probability >= 20) {
    return {
      bg: 'bg-orange-500',
      text: 'text-orange-600',
      border: 'border-orange-400',
      badge: 'bg-orange-50 text-orange-700 border-orange-200',
      level: 'warning',
      label: '경고'
    }
  }
  return {
    bg: 'bg-red-500',
    text: 'text-red-600',
    border: 'border-red-400',
    badge: 'bg-red-50 text-red-700 border-red-200',
    level: 'risk',
    label: '위험'
  }
}
