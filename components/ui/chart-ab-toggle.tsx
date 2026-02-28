"use client"

import { useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ChartABToggleProps {
  chartA: ReactNode
  chartB: ReactNode
  labelA?: string
  labelB?: string
}

export function ChartABToggle({ chartA, chartB, labelA = "현재", labelB = "제안" }: ChartABToggleProps) {
  const [variant, setVariant] = useState<"A" | "B">("A")

  return (
    <div className="relative">
      <div className="absolute top-3 right-3 z-20 flex items-center rounded-full border border-slate-300 overflow-hidden text-[10px] leading-none bg-white/90 backdrop-blur-sm shadow-sm">
        <button
          onClick={() => setVariant("A")}
          className={cn(
            "px-2 py-1 font-medium transition-colors",
            variant === "A"
              ? "bg-slate-800 text-white"
              : "text-slate-400 hover:text-slate-600"
          )}
        >
          A {labelA}
        </button>
        <button
          onClick={() => setVariant("B")}
          className={cn(
            "px-2 py-1 font-medium transition-colors",
            variant === "B"
              ? "bg-blue-600 text-white"
              : "text-slate-400 hover:text-slate-600"
          )}
        >
          B {labelB}
        </button>
      </div>
      {variant === "A" ? chartA : chartB}
    </div>
  )
}
