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
  generatePrediction, 
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
import { groups, serviceGroups, channelTypes, tenureCategories, generateAgents } from "@/lib/mock-data"
import { getStatusColorsByProbability } from "@/lib/utils"

interface PredictionsProps {
  onNavigateToFocus: () => void
}

// 목업 주차별 데이터 생성
const generateWeeklyData = () => {
  return {
    W1: { rate: Number((Math.random() * 2 + 2).toFixed(2)), count: Math.floor(Math.random() * 100) + 50 },
    W2: { rate: Number((Math.random() * 2 + 2.5).toFixed(2)), count: Math.floor(Math.random() * 150) + 100 },
    W3: { rate: Number((Math.random() * 2 + 2).toFixed(2)), count: Math.floor(Math.random() * 150) + 100 },
    W4: { rate: 0, count: 0 }, // 아직 데이터 없음
  }
}

// 목업 그룹별 예측 데이터
const generateGroupPredictions = (): GroupPrediction[] => {
  const predictions: GroupPrediction[] = []
  
  Object.entries(groups).forEach(([center, groupList]) => {
    const centerTargets = targets2026[center as keyof typeof targets2026]
    
    groupList.forEach((group) => {
      const [service, channel] = group.split("/")
      const weeklyAtt = [Math.random() * 2 + 1, Math.random() * 2 + 1.5, Math.random() * 2 + 1.2]
      const weeklyProc = [Math.random() * 3 + 2, Math.random() * 3 + 2.5, Math.random() * 3 + 2.2]
      
      const attPrediction = generatePrediction(
        weeklyAtt[2],
        weeklyAtt,
        centerTargets.attitude,
        15,
        16
      )
      
      const procPrediction = generatePrediction(
        weeklyProc[2],
        weeklyProc,
        centerTargets.process,
        15,
        16
      )
      
      const totalCurrent = (attPrediction.currentRate + procPrediction.currentRate) / 2
      const totalPredicted = (attPrediction.predictedRate + procPrediction.predictedRate) / 2
      const totalTarget = (centerTargets.attitude + centerTargets.process) / 2
      
      const totalPrediction: PredictionResult = {
        currentRate: Number(totalCurrent.toFixed(2)),
        predictedRate: Number(totalPredicted.toFixed(2)),
        targetRate: Number(totalTarget.toFixed(2)),
        achievementProbability: Math.round((attPrediction.achievementProbability + procPrediction.achievementProbability) / 2),
        trend: attPrediction.trend === 'worsening' || procPrediction.trend === 'worsening' ? 'worsening' : 
               attPrediction.trend === 'improving' && procPrediction.trend === 'improving' ? 'improving' : 'stable',
        riskLevel: attPrediction.riskLevel === 'critical' || procPrediction.riskLevel === 'critical' ? 'critical' :
                   attPrediction.riskLevel === 'high' || procPrediction.riskLevel === 'high' ? 'high' :
                   attPrediction.riskLevel === 'medium' || procPrediction.riskLevel === 'medium' ? 'medium' : 'low',
        weeklyRates: weeklyAtt.map((a, i) => Number(((a + weeklyProc[i]) / 2).toFixed(2))),
        w4Predicted: Number(((attPrediction.w4Predicted + procPrediction.w4Predicted) / 2).toFixed(2)),
      }
      
      const watchReasons = [
        ...checkWatchListConditions(attPrediction),
        ...checkWatchListConditions(procPrediction),
      ]
      
      predictions.push({
        center: center as "용산" | "광주",
        group,
        service,
        channel,
        attitudePrediction: attPrediction,
        processPrediction: procPrediction,
        totalPrediction,
        watchListReason: watchReasons.length > 0 ? [...new Set(watchReasons)] : undefined,
      })
    })
  })
  
  return predictions
}

// 목업 상담사별 예측 데이터
const generateAgentPredictions = (): AgentPrediction[] => {
  const agents = generateAgents()
  const predictions: AgentPrediction[] = []
  
  agents.slice(0, 50).forEach((agent) => {
    const attRate = Number((Math.random() * 8 + 1).toFixed(2))
    const procRate = Number((Math.random() * 10 + 1).toFixed(2))
    const totalRate = Number(((attRate + procRate) / 2).toFixed(2))
    
    const weeklyChange = Math.random() * 2 - 1
    const trend = weeklyChange < -0.3 ? 'improving' : weeklyChange > 0.3 ? 'worsening' : 'stable'
    
    const watchReasons = checkAgentWatchConditions(attRate, procRate)
    const riskLevel = watchReasons.length > 0 ? 
      (attRate > 10 || procRate > 12 ? 'critical' : 'high') :
      (totalRate > 5 ? 'medium' : 'low')
    
    const mainErrors = ['공감표현 누락', '상담유형 오설정', '가이드 미준수', '본인확인 누락']
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(Math.random() * 3) + 1)
    
    predictions.push({
      agentId: agent.id,
      agentName: agent.name,
      center: agent.center,
      group: agent.group,
      attitudeRate: attRate,
      processRate: procRate,
      totalRate,
      trend: trend as 'improving' | 'stable' | 'worsening',
      riskLevel: riskLevel as 'low' | 'medium' | 'high' | 'critical',
      watchListReason: watchReasons.length > 0 ? watchReasons : undefined,
      mainErrors,
    })
  })
  
  return predictions.sort((a, b) => {
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    return riskOrder[a.riskLevel] - riskOrder[b.riskLevel] || b.totalRate - a.totalRate
  })
}

// 주차별 추이 차트 데이터
const generateWeeklyTrendData = () => {
  return [
    { week: 'W1', 용산_태도: 2.8, 용산_오상담: 3.5, 광주_태도: 2.1, 광주_오상담: 1.8, 목표_태도: 3.0, 목표_오상담: 3.0 },
    { week: 'W2', 용산_태도: 3.2, 용산_오상담: 4.1, 광주_태도: 2.4, 광주_오상담: 1.5, 목표_태도: 3.0, 목표_오상담: 3.0 },
    { week: 'W3', 용산_태도: 2.9, 용산_오상담: 3.8, 광주_태도: 2.2, 광주_오상담: 1.6, 목표_태도: 3.0, 목표_오상담: 3.0 },
    { week: 'W4 (예측)', 용산_태도: 2.7, 용산_오상담: 3.5, 광주_태도: 2.0, 광주_오상담: 1.7, 목표_태도: 3.0, 목표_오상담: 3.0, isPredicted: true },
  ]
}

export function Predictions({ onNavigateToFocus }: PredictionsProps) {
  const [selectedCenter, setSelectedCenter] = useState<string>("전체")
  const [selectedService, setSelectedService] = useState<string>("전체")
  const [selectedChannel, setSelectedChannel] = useState<string>("전체")
  const [selectedTenure, setSelectedTenure] = useState<string>("전체")
  const [activeTab, setActiveTab] = useState("overview")
  
  const currentWeek = getCurrentWeek()
  const groupPredictions = useMemo(() => generateGroupPredictions(), [])
  const agentPredictions = useMemo(() => generateAgentPredictions(), [])
  const weeklyTrendData = useMemo(() => generateWeeklyTrendData(), [])
  
  // 필터링
  const filteredGroupPredictions = useMemo(() => {
    return groupPredictions.filter((p) => {
      if (selectedCenter !== "전체" && p.center !== selectedCenter) return false
      if (selectedService !== "전체" && p.service !== selectedService) return false
      if (selectedChannel !== "전체" && p.channel !== selectedChannel) return false
      return true
    })
  }, [groupPredictions, selectedCenter, selectedService, selectedChannel])
  
  const filteredAgentPredictions = useMemo(() => {
    return agentPredictions.filter((p) => {
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
          <span className="text-sm font-medium text-slate-700">2026년 1월</span>
        </div>
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
                if (prob >= 80) return '#22c55e' // green
                if (prob >= 60) return '#3b82f6' // blue
                if (prob >= 40) return '#eab308' // yellow
                if (prob >= 20) return '#f97316' // orange
                return '#ef4444' // red
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} domain={[0, 'auto']} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}
                      formatter={(value: number, name: string) => [`${value}%`, name.replace('_', ' ')]}
                    />
                    <Legend />
                    <ReferenceLine y={3.0} stroke="#ef4444" strokeDasharray="5 5" label={{ value: '목표', position: 'right', fontSize: 12 }} />
                    <Line type="monotone" dataKey="용산_태도" stroke="#1e3a5f" strokeWidth={2} dot={{ fill: '#1e3a5f' }} name="용산 태도" />
                    <Line type="monotone" dataKey="용산_오상담" stroke="#1e3a5f" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#1e3a5f' }} name="용산 오상담" />
                    <Line type="monotone" dataKey="광주_태도" stroke="#f9e000" strokeWidth={2} dot={{ fill: '#f9e000' }} name="광주 태도" />
                    <Line type="monotone" dataKey="광주_오상담" stroke="#f9e000" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#f9e000' }} name="광주 오상담" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">* W4는 W2→W3 변화량 기반 예측값입니다</p>
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
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-16">순위</TableHead>
                    <TableHead className="w-20">센터</TableHead>
                    <TableHead>그룹</TableHead>
                    <TableHead>상담사</TableHead>
                    <TableHead className="text-center">태도율</TableHead>
                    <TableHead className="text-center">오상담율</TableHead>
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
                      <TableCell className="font-medium">{p.agentName}</TableCell>
                      <TableCell className={`text-center ${p.attitudeRate > 5 ? 'text-red-600 font-bold' : ''}`}>
                        {p.attitudeRate}%
                      </TableCell>
                      <TableCell className={`text-center ${p.processRate > 6 ? 'text-red-600 font-bold' : ''}`}>
                        {p.processRate}%
                      </TableCell>
                      <TableCell className="text-center">
                        <TrendIcon trend={p.trend} />
                      </TableCell>
                      <TableCell className="text-center">
                        <RiskBadge level={p.riskLevel} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {p.mainErrors.slice(0, 2).map((err, j) => (
                            <Badge key={j} variant="outline" className="text-xs">{err}</Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                            <span className={`h-2 w-2 rounded-full ${p.center === "용산" ? "bg-[#1e3a5f]" : "bg-[#f9e000]"}`} />
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
                      <TableHead className="text-center text-slate-600 font-medium">태도율</TableHead>
                      <TableHead className="text-center text-slate-600 font-medium">오상담율</TableHead>
                      <TableHead className="text-center text-slate-600 font-medium">위험도</TableHead>
                      <TableHead className="text-slate-600 font-medium">등록 사유</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {watchListAgents.slice(0, 20).map((p, i) => (
                      <TableRow key={p.agentId} className={i % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50/50 hover:bg-slate-100"}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${p.center === "용산" ? "bg-[#1e3a5f]" : "bg-[#f9e000]"}`} />
                            <span className="text-slate-700">{p.center}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-700">{p.group}</TableCell>
                        <TableCell className="font-medium text-slate-800">{p.agentName}</TableCell>
                        <TableCell className="text-center">
                          <span className={`font-medium ${p.attitudeRate > 5 ? 'text-red-600' : 'text-slate-700'}`}>{p.attitudeRate}%</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-medium ${p.processRate > 6 ? 'text-red-600' : 'text-slate-700'}`}>{p.processRate}%</span>
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
  )
}
