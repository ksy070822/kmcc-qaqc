"use client"

import { ArrowLeft } from "lucide-react"

interface MypageBackButtonProps {
  onClick: () => void
  label?: string
}

export function MypageBackButton({ onClick, label = "메인 대시보드" }: MypageBackButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-4"
    >
      <ArrowLeft className="h-4 w-4" />
      <span>{label}</span>
    </button>
  )
}
