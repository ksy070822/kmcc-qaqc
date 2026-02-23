"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface MypageKpiCardProps {
  label: string
  value: string
  suffix?: string
  bgColor?: string // tailwind bg e.g. "bg-blue-50"
  textColor?: string
  badge?: string
  badgeColor?: string
  comparisons?: Array<{
    label: string
    value: string
  }>
  target?: {
    label: string
    value: number
    current: number
  }
}

export function MypageKpiCard({
  label,
  value,
  suffix,
  bgColor = "bg-white",
  textColor = "text-slate-900",
  badge,
  badgeColor = "bg-blue-50 text-blue-700 border-blue-200",
  comparisons,
  target,
}: MypageKpiCardProps) {
  const achieved = target ? (target.current <= target.value) : undefined

  return (
    <div className={cn("rounded-xl p-4 border border-slate-200", bgColor)}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-slate-500">{label}</p>
        {badge && (
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", badgeColor)}>
            {badge}
          </Badge>
        )}
      </div>
      <p className={cn("text-2xl font-bold tabular-nums", textColor)}>
        {value}
        {suffix && <span className={cn("text-sm font-normal ml-0.5", textColor === "text-white" ? "text-white/60" : "text-slate-400")}>{suffix}</span>}
      </p>
      {target && (
        <p className={cn("text-[11px] mt-1", achieved ? "text-emerald-600" : "text-red-500")}>
          목표 {target.value}% | {achieved ? "달성" : "미달"} ({(target.value - target.current).toFixed(1)}%p)
        </p>
      )}
      {comparisons && comparisons.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {comparisons.map((c, i) => (
            <p key={i} className="text-[11px] text-slate-500">
              {c.label} <span className="font-medium text-slate-700">{c.value}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
