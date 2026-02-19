"use client"

import { Progress } from "@/components/ui/progress"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Target, Users, Calendar, ArrowRight, Building2 } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts"
import { 
  getCurrentWeek, 
  checkWatchListConditions, 
  checkAgentWatchConditions,
  targets2026,
  riskLevelStyles,
  trendStyles,
  type PredictionResult,
  type GroupPrediction,
  type AgentPrediction
} from "@/lib/predictions"
import { groups, serviceGroups, channelTypes, tenureCategories } from "@/lib/constants"

// 운영 그룹 화이트리스트 (실제 운영 서비스/채널 조합만 허용)
const OPERATIONAL_GROUPS: Record<string, string[]> = {
  용산: ["택시/유선", "택시/채팅", "퀵/유선", "퀵/채팅"],
  광주: [
    "택시/유선", "택시/채팅",
    "대리/유선", "대리/채팅",
    "바이크마스/유선", "바이크마스/채팅", "바이크/마스/유선", "바이크/마스/채팅",
    "주차카오너/유선", "주차카오너/채팅", "주차/카오너/유선", "주차/카오너/채팅",
    "퀵/유선", "퀵/채팅",
    "심야/통합", "심야",
  ],
}

// 운영 그룹 여부 확인
function isOperationalGroup(center: string, group: string): boolean {
  const allowedGroups = OPERATIONAL_GROUPS[center]
  if (!allowedGroups) return false
  return allowedGroups.some(g => group === g || group.replace(/\//g, '') === g.replace(/\//g, ''))
}

// 관리자 직무 키워드 (제외 대상)
const MANAGER_KEYWORDS = ["팀장", "매니저", "관리자", "리더", "supervisor", "manager", "team lead"]
function isManager(agent: any): boolean {
  const group = (agent.group || agent.service || '').toLowerCase()
  const channel = (agent.channel || '').toLowerCase()
  return MANAGER_KEYWORDS.some(kw => group.includes(kw) || channel.includes(kw))
}
import { getStatusColorsByProbability } from "@/lib/utils"
import { usePredictions } from "@/hooks/use-predictions"
import { useAgents } from "@/hooks/use-agents"
import { usePredictionAI } from "@/hooks/use-prediction-ai"
import { Loader2, Bot } from "lucide-react"

interface PredictionsProps {
  onNavigateToFocus: () => void
}

// API 응답을 GroupPrediction 형식으로 변환
function convertToGroupPredictions(apiData: any[]): GroupPrediction[] {
  return apiData.map((data) => {
    const [service, channel] = data.serviceChannel.split('_')
    
    const attitudePrediction: PredictionResult = {
      currentRate: data.currentAttitudeRate,
      predictedRate: data.predictedAttitudeRate,
      targetRate: data.targetAttitudeRate,
      achievementProbability: data.attitudeAchievementProb,
      trend: data.attitudeTrend,
      riskLevel: data.attitudeRiskLevel,
      weeklyRates: data.weeklyMetrics.map((m: any) => m.attitudeRate),
      w4Predicted: data.w4PredictedAttitude,
    }
    
    const processPrediction: PredictionResult = {
      currentRate: data.currentOpsRate,
      predictedRate: data.predictedOpsRate,
      targetRate: data.targetOpsRate,
      achievementProbability: data.opsAchievementProb,
      trend: data.opsTrend,
      riskLevel: data.opsRiskLevel,
      weeklyRates: data.weeklyMetrics.map((m: any) => m.opsRate),
      w4Predicted: data.w4PredictedOps,
    }
    
    const totalCurrent = (attitudePrediction.currentRate + processPrediction.currentRate) / 2
    const totalPredicted = (attitudePrediction.predictedRate + processPrediction.predictedRate) / 2
    const totalTarget = (attitudePrediction.targetRate + processPrediction.targetRate) / 2
    const totalProb = Math.round((attitudePrediction.achievementProbability + processPrediction.achievementProbability) / 2)
    
    const totalPrediction: PredictionResult = {
      currentRate: Number(totalCurrent.toFixed(2)),
      predictedRate: Number(totalPredicted.toFixed(2)),
      targetRate: Number(totalTarget.toFixed(2)),
      achievementProbability: totalProb,
      trend: attitudePrediction.trend === 'improving' || processPrediction.trend === 'improving' ? 'improving' :
             attitudePrediction.trend === 'worsening' || processPrediction.trend === 'worsening' ? 'worsening' : 'stable',
      riskLevel: data.overallRiskLevel,
      weeklyRates: [],
      w4Predicted: (attitudePrediction.w4Predicted + processPrediction.w4Predicted) / 2,
    }
    
    const watchReasons = checkWatchListConditions(
      totalPrediction
    )
    
    return {
      center: data.center as '용산' | '광주',
      group: `${service}/${channel}`,
      service,
      channel,
      attitudePrediction,
      processPrediction,
      totalPrediction,
      watchListReason: watchReasons.length > 0 ? watchReasons : undefined,
    }
  })
}

// API 응답을 AgentPrediction 형식으로 변환 (관리자 직무 제외)
function convertToAgentPredictions(agents: any[], predictionsData?: any[]): AgentPrediction[] {
  // 관리자 직무 제외
  const filteredAgents = agents.filter(agent => !isManager(agent))

  // 실제 상담사 데이터를 사용하되, 예측 정보는 그룹 예측에서 가져오거나 계산
  return filteredAgents.slice(0, 50).map((agent) => {
    const attRate = agent.attitudeErrorRate
    const procRate = agent.opsErrorRate
    const totalRate = Number(((attRate + procRate) / 2).toFixed(2))
    
    // 그룹 예측 데이터에서 해당 상담사의 그룹 추세 찾기
    let trend: 'improving' | 'stable' | 'worsening' = 'stable'
    if (predictionsData && predictionsData.length > 0) {
      const groupKey = `${agent.center}_${agent.service}/${agent.channel}`
      const groupPrediction = predictionsData.find((p: any) => 
        p.center === agent.center && 
        p.dimensionValue === `${agent.service}/${agent.channel}`
      )
      
      if (groupPrediction) {
        // 그룹의 태도/오상담 추세를 기반으로 판단
        if (groupPrediction.attitudeTrend === 'worsening' || groupPrediction.opsTrend === 'worsening') {
          trend = 'worsening'
        } else if (groupPrediction.attitudeTrend === 'improving' && groupPrediction.opsTrend === 'improving') {
          trend = 'improving'
        } else {
          trend = 'stable'
        }
      } else {
        // 그룹 예측 데이터가 없으면 오류율 기준으로 추세 추정
        // 태도+오상담 합산 오류율이 높으면 악화, 낮으면 안정
        const totalRate = (attRate + procRate) / 2
        if (totalRate > 6) {
          trend = 'worsening'
        } else if (totalRate > 3) {
          trend = 'stable'
        } else {
          trend = 'improving'
        }
      }
    }
    
    const watchReasons = checkAgentWatchConditions(attRate, procRate)
    const riskLevel = watchReasons.length > 0
      ? (attRate > 10 || procRate > 12 ? 'critical' : 'high')
      : (totalRate > 5 ? 'medium' : 'low')
    
    // 실제 주요 오류 항목 사용 (topErrors가 있으면 사용, 없으면 빈 배열)
    // topErrors는 이미 AgentErrorInfo 형태 (name, count, rate 포함)
    const mainErrors = (agent.topErrors || []).map((err: any) => {
      // AgentErrorInfo 형태인지 확인
      if (typeof err === 'string') {
        return { name: err, rate: 0 }
      }
      return {
        name: err.name || err,
        rate: err.rate || 0,
      }
    })
    
    return {
      agentId: agent.id,
      agentName: agent.name,
      center: agent.center as '용산' | '광주',
      group: `${agent.service}/${agent.channel}`,
      attitudeRate: attRate,
      processRate: procRate,
      totalRate,
      trend: trend,
      riskLevel: riskLevel as 'low' | 'medium' | 'high' | 'critical',
      watchListReason: watchReasons.length > 0 ? watchReasons : undefined,
      mainErrors, // 실제 주요 오류 항목 사용 (오류율 포함)
    }
  })
}

// 주차별 추이 차트 데이터 생성 (API 데이터 기반)
function generateWeeklyTrendDataFromAPI(predictions: any[]): any[] {
  const weeks = ['W1', 'W2', 'W3', 'W4']
  const result: any[] = []

  const yongsanPreds = predictions.filter(p => p.center === '용산')
  const gwangjuPreds = predictions.filter(p => p.center === '광주')
  const yongsanCount = yongsanPreds.length || 1
  const gwangjuCount = gwangjuPreds.length || 1

  weeks.forEach((week) => {
    const weekData: any = {
      week,
      용산_태도: 0,
      용산_오상담: 0,
      광주_태도: 0,
      광주_오상담: 0,
      목표_태도: 3.0,
      목표_오상담: 3.0,
    }

    const weekIndex = weeks.indexOf(week)

    if (week === 'W4') {
      // W4: weeklyMetrics에 실적이 없으면 w4Predicted 예측값 사용
      let yongsanHasW4 = false
      let gwangjuHasW4 = false

      predictions.forEach((p) => {
        const w4Metric = p.weeklyMetrics?.find((m: any) => m.week === 'W4')
        if (w4Metric) {
          if (p.center === '용산') { weekData.용산_태도 += w4Metric.attitudeRate; weekData.용산_오상담 += w4Metric.opsRate; yongsanHasW4 = true }
          if (p.center === '광주') { weekData.광주_태도 += w4Metric.attitudeRate; weekData.광주_오상담 += w4Metric.opsRate; gwangjuHasW4 = true }
        }
      })

      // 실적 데이터가 없으면 예측값으로 대체
      if (!yongsanHasW4) {
        weekData.용산_태도 = Number((yongsanPreds.reduce((s, p) => s + (p.w4PredictedAttitude || 0), 0) / yongsanCount).toFixed(2))
        weekData.용산_오상담 = Number((yongsanPreds.reduce((s, p) => s + (p.w4PredictedOps || 0), 0) / yongsanCount).toFixed(2))
      } else {
        weekData.용산_태도 = Number((weekData.용산_태도 / yongsanCount).toFixed(2))
        weekData.용산_오상담 = Number((weekData.용산_오상담 / yongsanCount).toFixed(2))
      }
      if (!gwangjuHasW4) {
        weekData.광주_태도 = Number((gwangjuPreds.reduce((s, p) => s + (p.w4PredictedAttitude || 0), 0) / gwangjuCount).toFixed(2))
        weekData.광주_오상담 = Number((gwangjuPreds.reduce((s, p) => s + (p.w4PredictedOps || 0), 0) / gwangjuCount).toFixed(2))
      } else {
        weekData.광주_태도 = Number((weekData.광주_태도 / gwangjuCount).toFixed(2))
        weekData.광주_오상담 = Number((weekData.광주_오상담 / gwangjuCount).toFixed(2))
      }
      weekData.isPredicted = true
    } else {
      // W1~W3: 실적 데이터 사용
      predictions.forEach((p) => {
        if (p.weeklyMetrics && p.weeklyMetrics[weekIndex]) {
          const metrics = p.weeklyMetrics[weekIndex]
          if (p.center === '용산') {
            weekData.용산_태도 += metrics.attitudeRate
            weekData.용산_오상담 += metrics.opsRate
          } else if (p.center === '광주') {
            weekData.광주_태도 += metrics.attitudeRate
            weekData.광주_오상담 += metrics.opsRate
          }
        }
      })

      weekData.용산_태도 = Number((weekData.용산_태도 / yongsanCount).toFixed(2))
      weekData.용산_오상담 = Number((weekData.용산_오상담 / yongsanCount).toFixed(2))
      weekData.광주_태도 = Number((weekData.광주_태도 / gwangjuCount).toFixed(2))
      weekData.광주_오상담 = Number((weekData.광주_오상담 / gwangjuCount).toFixed(2))
    }

    result.push(weekData)
  })

  return result
}

// Mock functions removed - using actual API data only
// generateGroupPredictions() removed - use API data instead
// generateWeeklyTrendData() removed - use API data instead


export function Predictions({ onNavigateToFocus }: PredictionsProps) {
  const [selectedCenter, setSelectedCenter] = useState<string>("전체")
  const [selectedService, setSelectedService] = useState<string>("전체")
  const [selectedChannel, setSelectedChannel] = useState<string>("전체")
  const [selectedTenure, setSelectedTenure] = useState<string>("전체")
  const [activeTab, setActiveTab] = useState("overview")
  
  const currentWeek = getCurrentWeek()
  const currentMonth = new Date().toISOString().slice(0, 7)
  
  // 실제 API 데이터 조회
  const { data: predictionsData, loading: predictionsLoading, error: predictionsError } = usePredictions({
    month: currentMonth,
    center: selectedCenter !== "전체" ? selectedCenter : undefined,
  })
  
  const { data: agentsData, loading: agentsLoading, error: agentsError } = useAgents({
    center: selectedCenter !== "전체" ? selectedCenter : undefined,
    service: selectedService !== "전체" ? selectedService : undefined,
    channel: selectedChannel !== "전체" ? selectedChannel : undefined,
  })

  // AI 예측 분석
  const { analysis: aiAnalysis, loading: aiLoading, error: aiError, generateAnalysis } = usePredictionAI()
  
  // API 데이터를 컴포넌트 형식으로 변환
  const groupPredictions = useMemo(() => {
    if (predictionsData && predictionsData.length > 0) {
      return convertToGroupPredictions(predictionsData)
    }
    return []
  }, [predictionsData])
  
  const agentPredictions = useMemo(() => {
    if (agentsData && agentsData.length > 0) {
      // 실제 상담사 데이터 사용
      const predictions = convertToAgentPredictions(agentsData, predictionsData)
      // 위험도와 오류율 기준으로 정렬 (위험도 우선, 그 다음 오류율)
      return predictions.sort((a, b) => {
        const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 }
        const riskDiff = riskOrder[a.riskLevel] - riskOrder[b.riskLevel]
        if (riskDiff !== 0) return riskDiff
        return b.totalRate - a.totalRate
      })
    }
    // 데이터가 없으면 빈 배열 반환 (목업 데이터 사용 안 함)
    return []
  }, [agentsData, predictionsData])
  
  const weeklyTrendData = useMemo(() => {
    if (predictionsData && predictionsData.length > 0) {
      return generateWeeklyTrendDataFromAPI(predictionsData)
    }
    return []
  }, [predictionsData])
  
  // 필터링 (운영 그룹만 표시 - unknown, 게시판/보드, 팀장, 지금여기모니터링 등 제외)
  const filteredGroupPredictions = useMemo(() => {
    return groupPredictions.filter((p) => {
      // 운영 그룹 필터
      if (!isOperationalGroup(p.center, p.group)) return false
      if (selectedCenter !== "전체" && p.center !== selectedCenter) return false
      if (selectedService !== "전체" && p.service !== selectedService) return false
      if (selectedChannel !== "전체" && p.channel !== selectedChannel) return false
      return true
    })
  }, [groupPredictions, selectedCenter, selectedService, selectedChannel])
  
  const filteredAgentPredictions = useMemo(() => {
    return agentPredictions.filter((p) => {
      // 운영 그룹만 표시
      if (!isOperationalGroup(p.center, p.group)) return false
      if (selectedCenter !== "전체" && p.center !== selectedCenter) return false
      return true
    })
  }, [agentPredictions, selectedCenter])
  
  // 위험도별 카운트
  const riskCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 }
    filteredGroupPredictions.forEach((p) => {
      counts[p.totalPrediction.riskLevel]++
    })
    return counts
  }, [filteredGroupPredictions])
  
  // 집중관리 대상
  const watchListGroups = useMemo(() => {
    return filteredGroupPredictions.filter((p) => p.watchListReason && p.watchListReason.length > 0)
  }, [filteredGroupPredictions])
  
  const watchListAgents = useMemo(() => {
    return filteredAgentPredictions.filter((p) => p.watchListReason && p.watchListReason.length > 0)
  }, [filteredAgentPredictions])
  
  // 센터별 요약
  const centerSummary = useMemo(() => {
    const summary = {
      용산: { attitude: { current: 0, predicted: 0, target: targets2026.용산.attitude, prob: 0 }, process: { current: 0, predicted: 0, target: targets2026.용산.process, prob: 0 } },
      광주: { attitude: { current: 0, predicted: 0, target: targets2026.광주.attitude, prob: 0 }, process: { current: 0, predicted: 0, target: targets2026.광주.process, prob: 0 } },
    }
    
    const yongsanGroups = groupPredictions.filter((p) => p.center === "용산")
    const gwangjuGroups = groupPredictions.filter((p) => p.center === "광주")
    
    if (yongsanGroups.length > 0) {
      summary.용산.attitude.current = Number((yongsanGroups.reduce((sum, p) => sum + p.attitudePrediction.currentRate, 0) / yongsanGroups.length).toFixed(2))
      summary.용산.attitude.predicted = Number((yongsanGroups.reduce((sum, p) => sum + p.attitudePrediction.predictedRate, 0) / yongsanGroups.length).toFixed(2))
      summary.용산.attitude.prob = Math.round(yongsanGroups.reduce((sum, p) => sum + p.attitudePrediction.achievementProbability, 0) / yongsanGroups.length)
      summary.용산.process.current = Number((yongsanGroups.reduce((sum, p) => sum + p.processPrediction.currentRate, 0) / yongsanGroups.length).toFixed(2))
      summary.용산.process.predicted = Number((yongsanGroups.reduce((sum, p) => sum + p.processPrediction.predictedRate, 0) / yongsanGroups.length).toFixed(2))
      summary.용산.process.prob = Math.round(yongsanGroups.reduce((sum, p) => sum + p.processPrediction.achievementProbability, 0) / yongsanGroups.length)
    }
    
    if (gwangjuGroups.length > 0) {
      summary.광주.attitude.current = Number((gwangjuGroups.reduce((sum, p) => sum + p.attitudePrediction.currentRate, 0) / gwangjuGroups.length).toFixed(2))
      summary.광주.attitude.predicted = Number((gwangjuGroups.reduce((sum, p) => sum + p.attitudePrediction.predictedRate, 0) / gwangjuGroups.length).toFixed(2))
      summary.광주.attitude.prob = Math.round(gwangjuGroups.reduce((sum, p) => sum + p.attitudePrediction.achievementProbability, 0) / gwangjuGroups.length)
      summary.광주.process.current = Number((gwangjuGroups.reduce((sum, p) => sum + p.processPrediction.currentRate, 0) / gwangjuGroups.length).toFixed(2))
      summary.광주.process.predicted = Number((gwangjuGroups.reduce((sum, p) => sum + p.processPrediction.predictedRate, 0) / gwangjuGroups.length).toFixed(2))
      summary.광주.process.prob = Math.round(gwangjuGroups.reduce((sum, p) => sum + p.processPrediction.achievementProbability, 0) / gwangjuGroups.length)
    }
    
    return summary
  }, [groupPredictions])
  
  const TrendIcon = ({ trend }: { trend: 'improving' | 'stable' | 'worsening' }) => {
    if (trend === 'improving') return <TrendingDown className="h-4 w-4 text-green-600" />
    if (trend === 'worsening') return <TrendingUp className="h-4 w-4 text-red-600" />
    return <Minus className="h-4 w-4 text-gray-500" />
  }
  
  const RiskBadge = ({ level }: { level: 'low' | 'medium' | 'high' | 'critical' }) => {
    const style = riskLevelStyles[level]
    return <Badge className={style.color}>{style.label}</Badge>
  }
  
  return (
    <div className="space-y-6">
      {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">예측</h1>
            <p className="text-sm text-slate-500">현재 {currentWeek} 기준 | 데이터 흐름 기반 목표 달성 예측</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg">
            <Calendar className="h-4 w-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">{new Date().getFullYear()}년 {new Date().getMonth() + 1}월</span>
          </div>
        </div>
      
      {/* 로딩 및 에러 표시 */}
      {predictionsLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>예측 데이터 로딩 중...</span>
        </div>
      )}
      
      {predictionsError && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
          <strong>데이터 로드 오류:</strong> {predictionsError}
        </div>
      )}
      
      {!predictionsLoading && !predictionsError && groupPredictions.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          예측 데이터가 없습니다.
        </div>
      )}
      
      {!predictionsLoading && !predictionsError && groupPredictions.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg">
            <Calendar className="h-4 w-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">2026년 1월</span>
          </div>
          
          {/* 필터 */}
          <Card className="bg-white border border-slate-200">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4">
            <Select value={selectedCenter} onValueChange={setSelectedCenter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="센터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="전체">전체 센터</SelectItem>
                <SelectItem value="용산">용산</SelectItem>
                <SelectItem value="광주">광주</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="서비스" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="전체">전체 서비스</SelectItem>
                {[...new Set([...serviceGroups.용산, ...serviceGroups.광주])].map((service) => (
                  <SelectItem key={service} value={service}>{service}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="채널" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="전체">전체 채널</SelectItem>
                {channelTypes.map((ch) => (
                  <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
          
          {/* 위험도 요약 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-red-50/50 border border-red-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">긴급 (Critical)</p>
                <p className="text-3xl font-bold text-red-600">{riskCounts.critical}<span className="text-base font-normal text-slate-400 ml-1">건</span></p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-orange-50/50 border border-orange-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">주의 (High)</p>
                <p className="text-3xl font-bold text-orange-600">{riskCounts.high}<span className="text-base font-normal text-slate-400 ml-1">건</span></p>
              </div>
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-blue-50/50 border border-blue-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">관찰 (Medium)</p>
                <p className="text-3xl font-bold text-blue-600">{riskCounts.medium}<span className="text-base font-normal text-slate-400 ml-1">건</span></p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-green-50/50 border border-green-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">안정 (Low)</p>
                <p className="text-3xl font-bold text-green-600">{riskCounts.low}<span className="text-base font-normal text-slate-400 ml-1">건</span></p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <Target className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="overview" className="data-[state=active]:bg-white">센터별 예측</TabsTrigger>
          <TabsTrigger value="groups" className="data-[state=active]:bg-white">그룹별 예측</TabsTrigger>
          <TabsTrigger value="agents" className="data-[state=active]:bg-white">상담사별 위험</TabsTrigger>
          <TabsTrigger value="watchlist" className="data-[state=active]:bg-white">
            집중관리 대상
            {(watchListGroups.length + watchListAgents.length) > 0 && (
              <Badge variant="destructive" className="ml-2">{watchListGroups.length + watchListAgents.length}</Badge>
            )}
          </TabsTrigger>
            </TabsList>
            
            {/* 센터별 예측 탭 */}
            <TabsContent value="overview" className="space-y-6">
              {/* 센터별 요약 카드 */}
              <div className="grid grid-cols-2 gap-6">
            {(["용산", "광주"] as const).map((center) => {
              // 센터의 평균 달성확률 계산
              const avgProb = (centerSummary[center].attitude.prob + centerSummary[center].process.prob) / 2
              // 5단계 색상 체계 적용
              const centerStatus = getStatusColorsByProbability(avgProb)
              const attStatus = getStatusColorsByProbability(centerSummary[center].attitude.prob)
              const procStatus = getStatusColorsByProbability(centerSummary[center].process.prob)
              
              // Progress bar 색상 (hex)
              const getProgressColor = (prob: number) => {
                if (prob >= 80) return '#34A853' // green
                if (prob >= 60) return '#2c6edb' // blue
                if (prob >= 40) return '#ffcd00' // yellow
                if (prob >= 20) return '#DD2222' // orange
                return '#DD2222' // red
              }
              
              return (
                <Card key={center} className={`bg-white border ${centerStatus.border}`} style={{ boxShadow: 'none' }}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className={`h-3 w-3 rounded-full ${center === "용산" ? "bg-navy" : "bg-kakao"}`} />
                      {center}센터 월말 예측
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 상담태도 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">상담태도</span>
                        <span className="text-slate-500 text-xs">목표: {centerSummary[center].attitude.target}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs text-slate-600 mb-1">
                            <span>현재: {centerSummary[center].attitude.current}%</span>
                            <span className="font-medium">예측: {centerSummary[center].attitude.predicted}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, (centerSummary[center].attitude.target / centerSummary[center].attitude.predicted) * 100)}%`,
                                background: getProgressColor(centerSummary[center].attitude.prob),
                              }}
                            />
                          </div>
                        </div>
                        <Badge 
                          variant="outline"
                          className={`text-xs border ${attStatus.badge}`}
                        >
                          {attStatus.label} {centerSummary[center].attitude.prob}%
                        </Badge>
                      </div>
                    </div>
                    
                    {/* 오상담/오처리 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">오상담/오처리</span>
                        <span className="text-slate-500 text-xs">목표: {centerSummary[center].process.target}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs text-slate-600 mb-1">
                            <span>현재: {centerSummary[center].process.current}%</span>
                            <span className="font-medium">예측: {centerSummary[center].process.predicted}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, (centerSummary[center].process.target / centerSummary[center].process.predicted) * 100)}%`,
                                background: getProgressColor(centerSummary[center].process.prob),
                              }}
                            />
                          </div>
                        </div>
                        <Badge 
                          variant="outline"
                          className={`text-xs border ${procStatus.badge}`}
                        >
                          {procStatus.label} {centerSummary[center].process.prob}%
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
              </div>
              
              {/* 주차별 추이 차트 */}
              <Card>
            <CardHeader>
              <CardTitle>주차별 오류율 추이 및 W4 예측</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
                    <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} domain={[0, 'auto']} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #D9D9D9' }}
                      formatter={(value: number, name: string) => [`${value}%`, name.replace('_', ' ')]}
                    />
                    <Legend />
                    <ReferenceLine y={3.0} stroke="#DD2222" strokeDasharray="5 5" label={{ value: '목표', position: 'right', fontSize: 12 }} />
                    <Line type="monotone" dataKey="용산_태도" stroke="#2c6edb" strokeWidth={2} dot={{ fill: '#2c6edb' }} name="용산 태도" />
                    <Line type="monotone" dataKey="용산_오상담" stroke="#2c6edb" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#2c6edb' }} name="용산 오상담" />
                    <Line type="monotone" dataKey="광주_태도" stroke="#ffcd00" strokeWidth={2} dot={{ fill: '#ffcd00' }} name="광주 태도" />
                    <Line type="monotone" dataKey="광주_오상담" stroke="#ffcd00" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#ffcd00' }} name="광주 오상담" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">* W4는 W2→W3 변화량 기반 예측값입니다</p>
              </CardContent>
              </Card>

              {/* AI 예측 분석 */}
              <Card className="border border-indigo-200 bg-indigo-50/30">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Bot className="h-5 w-5 text-indigo-600" />
                    AI 예측 분석
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!aiAnalysis && !aiLoading && !aiError && (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground mb-3">
                        AI가 현재 예측 데이터를 분석하여 추이, 월말 전망, 액션플랜을 제안합니다.
                      </p>
                      <Button
                        variant="outline"
                        className="border-indigo-300 text-indigo-700 hover:bg-indigo-100"
                        onClick={() => generateAnalysis(
                          selectedCenter !== "전체" ? selectedCenter : undefined,
                          predictionsData || [],
                          centerSummary
                        )}
                      >
                        <Bot className="h-4 w-4 mr-2" />
                        AI 분석 생성
                      </Button>
                    </div>
                  )}

                  {aiLoading && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin mr-2 text-indigo-600" />
                      <span className="text-sm text-indigo-700">AI가 분석 중...</span>
                    </div>
                  )}

                  {aiError && (
                    <div className="space-y-2">
                      <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
                        {aiError}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateAnalysis(
                          selectedCenter !== "전체" ? selectedCenter : undefined,
                          predictionsData || [],
                          centerSummary
                        )}
                      >
                        다시 시도
                      </Button>
                    </div>
                  )}

                  {aiAnalysis && (
                    <div className="space-y-3">
                      <div
                        className="prose prose-sm prose-slate max-w-none
                          [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2
                          [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
                          [&_ul]:my-1 [&_li]:my-0.5 [&_p]:my-1
                          [&_strong]:text-slate-900"
                        dangerouslySetInnerHTML={{
                          __html: aiAnalysis
                            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/^- \[ \] (.*$)/gm, '<li class="flex items-start gap-2"><input type="checkbox" disabled class="mt-1" /><span>$1</span></li>')
                            .replace(/^- (.*$)/gm, '<li>$1</li>')
                            .replace(/(<li>[\s\S]*?<\/li>)/gm, (match) => {
                              if (!match.startsWith('<ul>')) return match;
                              return match;
                            })
                            .replace(/((?:<li[^>]*>[\s\S]*?<\/li>\n?)+)/g, '<ul>$1</ul>')
                            .replace(/\n\n/g, '</p><p>')
                            .replace(/\n/g, '<br/>')
                        }}
                      />
                      <div className="border-t pt-3 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-indigo-600 hover:text-indigo-800"
                          onClick={() => generateAnalysis(
                            selectedCenter !== "전체" ? selectedCenter : undefined,
                            predictionsData || [],
                            centerSummary
                          )}
                        >
                          <Bot className="h-4 w-4 mr-1" />
                          다시 분석
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* 그룹별 예측 탭 */}
            <TabsContent value="groups">
              <Card>
                <CardHeader>
                  <CardTitle>그룹별 월말 예측 현황</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-20">센터</TableHead>
                    <TableHead>그룹</TableHead>
                    <TableHead className="text-center">현재 태도</TableHead>
                    <TableHead className="text-center">예측 태도</TableHead>
                    <TableHead className="text-center">현재 오상담</TableHead>
                    <TableHead className="text-center">예측 오상담</TableHead>
                    <TableHead className="text-center">달성확률</TableHead>
                    <TableHead className="text-center">추세</TableHead>
                    <TableHead className="text-center">위험도</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGroupPredictions.map((p, i) => (
                    <TableRow key={i} className={p.totalPrediction.riskLevel === 'critical' ? 'bg-red-50' : p.totalPrediction.riskLevel === 'high' ? 'bg-orange-50' : ''}>
                      <TableCell>
                        <span className={`inline-flex h-2 w-2 rounded-full mr-2 ${p.center === "용산" ? "bg-navy" : "bg-kakao"}`} />
                        {p.center}
                      </TableCell>
                      <TableCell className="font-medium">{p.group}</TableCell>
                      <TableCell className="text-center">{p.attitudePrediction.currentRate.toFixed(2)}%</TableCell>
                      <TableCell className={`text-center font-medium ${p.attitudePrediction.predictedRate > p.attitudePrediction.targetRate ? 'text-red-600' : 'text-green-600'}`}>
                        {p.attitudePrediction.predictedRate.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-center">{p.processPrediction.currentRate.toFixed(2)}%</TableCell>
                      <TableCell className={`text-center font-medium ${p.processPrediction.predictedRate > p.processPrediction.targetRate ? 'text-red-600' : 'text-green-600'}`}>
                        {p.processPrediction.predictedRate.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={p.totalPrediction.achievementProbability >= 70 ? 'text-green-600' : p.totalPrediction.achievementProbability >= 40 ? 'text-yellow-600' : 'text-red-600'}>
                          {p.totalPrediction.achievementProbability}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <TrendIcon trend={p.totalPrediction.trend} />
                          <span className={trendStyles[p.totalPrediction.trend].color}>{trendStyles[p.totalPrediction.trend].label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <RiskBadge level={p.totalPrediction.riskLevel} />
                      </TableCell>
                    </TableRow>
                  ))}
                  </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* 상담사별 위험 탭 */}
            <TabsContent value="agents">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    상담사별 위험 순위 (상위 50명)
                  </CardTitle>
                  {/* 위험도 정의 */}
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-2">
                    <span><Badge className="bg-red-100 text-red-700 border-red-300 text-[10px] mr-1">긴급</Badge>태도 &gt;10% 또는 오상담 &gt;12%</span>
                    <span><Badge className="bg-orange-100 text-orange-700 border-orange-300 text-[10px] mr-1">주의</Badge>태도 &gt;5% 또는 오상담 &gt;6%</span>
                    <span><Badge className="bg-blue-100 text-blue-700 border-blue-300 text-[10px] mr-1">관찰</Badge>전체 오류율 &gt;5%</span>
                    <span><Badge className="bg-green-100 text-green-700 border-green-300 text-[10px] mr-1">안정</Badge>전체 오류율 ≤5%</span>
                  </div>
                </CardHeader>
                <CardContent>
                  {agentsLoading && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>상담사 데이터 로딩 중...</span>
                    </div>
                  )}
                  {agentsError && (
                    <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm mb-4">
                      <strong>데이터 로드 오류:</strong> {agentsError}
                    </div>
                  )}
                  {!agentsLoading && !agentsError && filteredAgentPredictions.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      상담사 데이터가 없습니다.
                    </div>
                  )}
                  {!agentsLoading && !agentsError && filteredAgentPredictions.length > 0 && (
                  <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-16">순위</TableHead>
                    <TableHead className="w-20">센터</TableHead>
                    <TableHead>그룹</TableHead>
                    <TableHead>상담사</TableHead>
                    <TableHead className="text-center">태도오류</TableHead>
                    <TableHead className="text-center">오상담/오처리오류</TableHead>
                    <TableHead className="text-center">추세</TableHead>
                    <TableHead className="text-center">위험도</TableHead>
                    <TableHead>주요 오류</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAgentPredictions.slice(0, 30).map((p, i) => (
                    <TableRow key={p.agentId} className={p.riskLevel === 'critical' ? 'bg-red-50' : p.riskLevel === 'high' ? 'bg-orange-50' : ''}>
                      <TableCell className="font-medium">{i + 1}</TableCell>
                      <TableCell>
                        <span className={`inline-flex h-2 w-2 rounded-full mr-2 ${p.center === "용산" ? "bg-navy" : "bg-kakao"}`} />
                        {p.center}
                      </TableCell>
                      <TableCell>{p.group}</TableCell>
                      <TableCell className="font-medium">{p.agentName} / {p.agentId}</TableCell>
                      <TableCell className={`text-center ${p.attitudeRate > 5 ? 'text-red-600 font-bold' : ''}`}>
                        {p.attitudeRate.toFixed(1)}%
                      </TableCell>
                      <TableCell className={`text-center ${p.processRate > 6 ? 'text-red-600 font-bold' : ''}`}>
                        {p.processRate.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <TrendIcon trend={p.trend} />
                          <span className={trendStyles[p.trend].color + " text-xs"}>{trendStyles[p.trend].label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <RiskBadge level={p.riskLevel} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {p.mainErrors && p.mainErrors.length > 0 ? (
                            p.mainErrors.slice(0, 2).map((err: any, j: number) => (
                              <Badge key={j} variant="outline" className="text-xs">
                                {typeof err === 'string' ? err : err.name || '오류'}
                                {typeof err === 'object' && err.rate !== undefined && ' (' + err.rate.toFixed(1) + '%)'}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  </TableBody>
                  </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* 집중관리 대상 탭 */}
            <TabsContent value="watchlist" className="space-y-6">
              {/* 자동 등록 조건 안내 */}
              <Card className="border-yellow-300 bg-yellow-50">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-800">자동 등록 조건</p>
                      <ul className="mt-1 text-yellow-700 space-y-0.5">
                        <li>목표 달성 확률 30% 미만</li>
                        <li>전주 대비 50% 이상 급등</li>
                        <li>악화 추세 + 목표 초과</li>
                        <li>상담사: 태도 5% 초과 또는 오상담 6% 초과</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* 그룹 집중관리 */}
              <Card className="bg-white border border-slate-200">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="flex items-center justify-between text-lg">
                <span className="text-slate-800">그룹 집중관리 대상 ({watchListGroups.length}개)</span>
                <Button variant="outline" size="sm" onClick={onNavigateToFocus} className="text-slate-600 bg-transparent">
                  집중관리 탭으로 이동 <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {watchListGroups.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">집중관리 대상 그룹이 없습니다</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="text-slate-600 font-medium">센터</TableHead>
                      <TableHead className="text-slate-600 font-medium">그룹</TableHead>
                      <TableHead className="text-center text-slate-600 font-medium">예측 오류율</TableHead>
                      <TableHead className="text-center text-slate-600 font-medium">달성확률</TableHead>
                      <TableHead className="text-center text-slate-600 font-medium">위험도</TableHead>
                      <TableHead className="text-slate-600 font-medium">등록 사유</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {watchListGroups.map((p, i) => (
                      <TableRow key={i} className={i % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50/50 hover:bg-slate-100"}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${p.center === "용산" ? "bg-[#2c6edb]" : "bg-[#ffcd00]"}`} />
                            <span className="text-slate-700">{p.center}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-slate-800">{p.group}</TableCell>
                        <TableCell className="text-center font-semibold text-slate-900">{p.totalPrediction.predictedRate.toFixed(2)}%</TableCell>
                        <TableCell className="text-center">
                          <span className={`font-medium ${p.totalPrediction.achievementProbability < 30 ? 'text-red-600' : p.totalPrediction.achievementProbability < 60 ? 'text-amber-600' : 'text-green-600'}`}>
                            {p.totalPrediction.achievementProbability}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center"><RiskBadge level={p.totalPrediction.riskLevel} /></TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {p.watchListReason?.map((reason, j) => (
                              <Badge key={j} variant="outline" className="text-xs bg-slate-100 text-slate-600 border-slate-300">{reason}</Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
                </CardContent>
              </Card>
              
              {/* 상담사 집중관리 */}
              <Card className="bg-white border border-slate-200">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg text-slate-800">상담사 집중관리 대상 ({watchListAgents.length}명)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {watchListAgents.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">집중관리 대상 상담사가 없습니다</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="text-slate-600 font-medium">센터</TableHead>
                      <TableHead className="text-slate-600 font-medium">그룹</TableHead>
                      <TableHead className="text-slate-600 font-medium">상담사</TableHead>
                      <TableHead className="text-center text-slate-600 font-medium">태도오류</TableHead>
                      <TableHead className="text-center text-slate-600 font-medium">오상담/오처리오류</TableHead>
                      <TableHead className="text-center text-slate-600 font-medium">위험도</TableHead>
                      <TableHead className="text-slate-600 font-medium">등록 사유</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {watchListAgents.slice(0, 20).map((p, i) => (
                      <TableRow key={p.agentId} className={i % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50/50 hover:bg-slate-100"}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${p.center === "용산" ? "bg-[#2c6edb]" : "bg-[#ffcd00]"}`} />
                            <span className="text-slate-700">{p.center}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-700">{p.group}</TableCell>
                        <TableCell className="font-medium text-slate-800">{p.agentName} / {p.agentId}</TableCell>
                        <TableCell className="text-center">
                          <span className={`font-medium ${p.attitudeRate > 5 ? 'text-red-600' : 'text-slate-700'}`}>{p.attitudeRate.toFixed(1)}%</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-medium ${p.processRate > 6 ? 'text-red-600' : 'text-slate-700'}`}>{p.processRate.toFixed(1)}%</span>
                        </TableCell>
                        <TableCell className="text-center"><RiskBadge level={p.riskLevel} /></TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {p.watchListReason?.map((reason, j) => (
                              <Badge key={j} variant="outline" className="text-xs whitespace-nowrap bg-slate-100 text-slate-600 border-slate-300">{reason}</Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}
