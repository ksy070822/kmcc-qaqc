import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 5단계 상태 색상 체계
 * 녹색(green) = 달성 (목표의 80% 이하)
 * 파랑(blue) = 순항 (목표 달성, 100% 이하)
 * 노랑(yellow) = 주의 (목표의 120% 이하)
 * 주황(orange) = 경고 (목표의 150% 이하)
 * 레드(red) = 위험 (목표의 150% 초과)
 */
export type StatusLevel = 'achieved' | 'onTrack' | 'caution' | 'warning' | 'danger'

export interface StatusColors {
  bg: string
  text: string
  border: string
  badge: string
  level: StatusLevel
  label: string
}

// Alias for backward compatibility
export const getStatusColor = (value: number, target: number) => getStatusColors(value, target)

export function getStatusColors(value: number, target: number): StatusColors {
  const ratio = value / target
  
  if (ratio <= 0.8) {
    return {
      bg: 'bg-green-500',
      text: 'text-green-600',
      border: 'border-green-400',
      badge: 'bg-green-50 text-green-700 border-green-200',
      level: 'achieved',
      label: '달성'
    }
  }
  if (ratio <= 1.0) {
    return {
      bg: 'bg-blue-500',
      text: 'text-blue-600',
      border: 'border-blue-400',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      level: 'onTrack',
      label: '순항'
    }
  }
  if (ratio <= 1.2) {
    return {
      bg: 'bg-yellow-500',
      text: 'text-yellow-600',
      border: 'border-yellow-400',
      badge: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      level: 'caution',
      label: '주의'
    }
  }
  if (ratio <= 1.5) {
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
    level: 'danger',
    label: '위험'
  }
}

/**
 * 달성 확률 기반 상태 색상
 * 80% 이상 = 녹색 (달성 예상)
 * 60-80% = 파랑 (순항)
 * 40-60% = 노랑 (주의)
 * 20-40% = 주황 (경고)
 * 20% 미만 = 레드 (위험)
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
    level: 'danger',
    label: '위험'
  }
}
