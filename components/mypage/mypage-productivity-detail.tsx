"use client"

import { MypageBackButton } from "@/components/mypage/mypage-back-button"
import { Card, CardContent } from "@/components/ui/card"

interface MypageProductivityDetailProps {
  user: { userId?: string; name?: string; center?: string } | null
  onBack: () => void
}

export function MypageProductivityDetail({ user, onBack }: MypageProductivityDetailProps) {
  return (
    <div className="space-y-4">
      <MypageBackButton onBack={onBack} title="생산성 상세" />
      <Card>
        <CardContent className="py-12 text-center text-slate-400">
          생산성 데이터 연동 준비 중입니다.
        </CardContent>
      </Card>
    </div>
  )
}
