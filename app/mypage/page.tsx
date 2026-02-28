"use client"

import { useState } from "react"
import { useMypageContext } from "@/contexts/mypage-context"
import { MypageMainView } from "@/components/mypage/mypage-main-view"
import { MypageQcDetail } from "@/components/mypage/mypage-qc-detail"
import { MypageCsatDetail } from "@/components/mypage/mypage-csat-detail"
import { MypageQaDetail } from "@/components/mypage/mypage-qa-detail"
import { MypageQuizDetail } from "@/components/mypage/mypage-quiz-detail"
import { MypageProductivityDetail } from "@/components/mypage/mypage-productivity-detail"

type ViewType = "main" | "qc" | "csat" | "qa" | "quiz" | "productivity"

export default function MypagePage() {
  const { user, agentId } = useMypageContext()
  const [activeView, setActiveView] = useState<ViewType>("main")

  const goBack = () => setActiveView("main")

  switch (activeView) {
    case "qc":
      return <MypageQcDetail agentId={agentId} onBack={goBack} />
    case "csat":
      return <MypageCsatDetail agentId={agentId} onBack={goBack} />
    case "qa":
      return <MypageQaDetail agentId={agentId} onBack={goBack} />
    case "quiz":
      return <MypageQuizDetail agentId={agentId} onBack={goBack} />
    case "productivity":
      return <MypageProductivityDetail user={user} onBack={goBack} />
    default:
      return (
        <MypageMainView
          agentId={agentId}
          user={user}
          onNavigate={(view) => setActiveView(view as ViewType)}
        />
      )
  }
}
