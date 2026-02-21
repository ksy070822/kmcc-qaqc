"use client"

import { useState, useMemo, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { evaluationItems, serviceGroups, channelTypes, tenureCategories } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

// 심야는 채널 통합 (유선+채팅 합산)
const MERGED_CHANNEL_SERVICES = ["심야"]

// 서비스-채널 조합 키 생성
function buildServiceChannelKeys(center: "용산" | "광주"): { key: string; label: string; center: string }[] {
  const keys: { key: string; label: string; center: string }[] = []
  for (const service of serviceGroups[center]) {
    if (MERGED_CHANNEL_SERVICES.includes(service)) {
      // 심야: 채널 통합
      keys.push({ key: `${center}-${service}-통합`, label: service, center })
    } else {
      for (const channel of channelTypes) {
        keys.push({ key: `${center}-${service}-${channel}`, label: `${service} ${channel}`, center })
      }
    }
  }
  return keys
}

export function TenureErrorTable() {
  const [selectedCenter, setSelectedCenter] = useState<"all" | "용산" | "광주">("all")
  const [selectedService, setSelectedService] = useState("all")
  const [tenureStats, setTenureStats] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 근속기간별 오류 데이터 조회
  useEffect(() => {
    const fetchTenureStats = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ type: "tenure-stats" })
        if (selectedCenter !== "all") params.set("center", selectedCenter)
        if (selectedService !== "all") params.set("service", selectedService)
        const res = await fetch(`/api/data?${params.toString()}`)
        const json = await res.json()
        if (json.success && json.data) {
          setTenureStats(json.data)
        } else {
          setError(json.error || "데이터 조회에 실패했습니다.")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "네트워크 오류가 발생했습니다.")
      } finally {
        setLoading(false)
      }
    }
    fetchTenureStats()
  }, [selectedCenter, selectedService])

  // 서비스-채널 키 목록 (센터별)
  const allKeys = useMemo(() => {
    if (selectedCenter === "all") {
      return [
        ...buildServiceChannelKeys("용산"),
        ...buildServiceChannelKeys("광주"),
      ]
    }
    return buildServiceChannelKeys(selectedCenter)
  }, [selectedCenter])

  // 데이터 변환
  const tenureData = useMemo(() => {
    const data: Record<string, Record<string, Record<string, number>>> = {}

    // 키별 빈 데이터 초기화
    for (const { key } of allKeys) {
      data[key] = {}
      for (const tenure of tenureCategories) {
        data[key][tenure] = {}
        for (const item of evaluationItems) {
          data[key][tenure][item.id] = 0
        }
      }
    }

    // 실제 데이터 매핑
    tenureStats.forEach((stat) => {
      const isMerged = MERGED_CHANNEL_SERVICES.includes(stat.service)
      const key = isMerged
        ? `${stat.center}-${stat.service}-통합`
        : `${stat.center}-${stat.service}-${stat.channel}`

      if (data[key] && data[key][stat.tenureGroup]) {
        Object.entries(stat.items).forEach(([itemId, count]) => {
          if (data[key][stat.tenureGroup][itemId] !== undefined) {
            data[key][stat.tenureGroup][itemId] += count as number
          }
        })
      }
    })

    return data
  }, [tenureStats, allKeys])

  const services =
    selectedCenter === "all"
      ? [...new Set([...serviceGroups["용산"], ...serviceGroups["광주"]])]
      : serviceGroups[selectedCenter]

  // 필터링된 키 목록
  const filteredKeys = useMemo(() => {
    return allKeys.filter(({ key }) => {
      const parts = key.split("-")
      const service = parts.slice(1, -1).join("-") // center-서비스명-channel (서비스명에 -가 없으므로 parts[1])
      if (selectedService !== "all" && parts[1] !== selectedService) return false
      return true
    })
  }, [allKeys, selectedService])

  // 센터별 그룹핑 (헤더 행 삽입용)
  const groupedByCenterKeys = useMemo(() => {
    const groups: { center: string; keys: typeof filteredKeys }[] = []
    let currentCenter = ""
    let currentGroup: typeof filteredKeys = []

    for (const item of filteredKeys) {
      if (item.center !== currentCenter) {
        if (currentGroup.length > 0) {
          groups.push({ center: currentCenter, keys: currentGroup })
        }
        currentCenter = item.center
        currentGroup = [item]
      } else {
        currentGroup.push(item)
      }
    }
    if (currentGroup.length > 0) {
      groups.push({ center: currentCenter, keys: currentGroup })
    }
    return groups
  }, [filteredKeys])

  const colCount = evaluationItems.length + 3 // 구분(2) + items(16) + 합계(1)

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="text-sm font-bold text-gray-800">근속기간별 오류 현황</h3>
        <div className="flex gap-2">
          <Select
            value={selectedCenter}
            onValueChange={(v) => {
              setSelectedCenter(v as typeof selectedCenter)
              setSelectedService("all")
            }}
          >
            <SelectTrigger className="w-[100px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="용산">용산</SelectItem>
              <SelectItem value="광주">광주</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedService} onValueChange={setSelectedService}>
            <SelectTrigger className="w-[120px] h-8 text-sm">
              <SelectValue placeholder="서비스" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {services.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span>데이터 로딩 중...</span>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm mb-4">
          <strong>데이터 로드 오류:</strong> {error}
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-left" colSpan={2}>구분</th>
                {evaluationItems.map((item) => (
                  <th key={item.id}>
                    <span
                      className={cn(
                        "inline-block w-2 h-2 rounded-full mr-1",
                        item.category === "상담태도" ? "bg-[#2c6edb]" : "bg-[#9E9E9E]",
                      )}
                    />
                    {item.shortName}
                  </th>
                ))}
                <th>합계</th>
              </tr>
            </thead>
            <tbody>
              {groupedByCenterKeys.map((group) => (
                <>
                  {/* 센터 헤더 행 */}
                  <tr key={`header-${group.center}`} className={cn(
                    "border-b-2",
                    group.center === "용산"
                      ? "bg-[#2c6edb]/20 border-[#2c6edb]/30"
                      : "bg-[#9E9E9E]/20 border-[#9E9E9E]/30",
                  )}>
                    <td
                      colSpan={colCount}
                      className={cn(
                        "sticky left-0 p-2 font-bold text-sm",
                        group.center === "용산"
                          ? "bg-[#2c6edb]/20 text-[#2c6edb]"
                          : "bg-[#9E9E9E]/20 text-[#666666]",
                      )}
                    >
                      {group.center}센터
                    </td>
                  </tr>

                  {/* 서비스-채널별 행 */}
                  {group.keys.map(({ key, label }) => {
                    const tenureRows = tenureCategories.map((tenure, tenureIdx) => {
                      const rowData = tenureData[key]?.[tenure] || {}
                      const total = evaluationItems.reduce((sum, item) => sum + (rowData[item.id] || 0), 0)

                      return (
                        <tr
                          key={`${key}-${tenure}`}
                          className={cn(
                            "border-b border-slate-100",
                            tenureIdx === tenureCategories.length - 1 ? "border-b-2" : "",
                          )}
                        >
                          {tenureIdx === 0 && (
                            <td
                              rowSpan={tenureCategories.length + 1}
                              className={cn(
                                "sticky left-0 p-2 font-semibold text-slate-700 border-r border-slate-200",
                                group.center === "용산" ? "bg-[#2c6edb]/10" : "bg-[#9E9E9E]/10",
                              )}
                            >
                              {label}
                            </td>
                          )}
                          <td className="p-2 text-slate-600 bg-slate-50">{tenure}</td>
                          {evaluationItems.map((item) => (
                            <td
                              key={`${key}-${tenure}-${item.id}`}
                              className={cn(
                                "p-2 text-center",
                                (rowData[item.id] || 0) > 5 ? "text-red-600 font-semibold" : "text-slate-600",
                              )}
                            >
                              {rowData[item.id] || 0}
                            </td>
                          ))}
                          <td className="p-2 text-center font-semibold bg-slate-100 text-slate-800">{total}</td>
                        </tr>
                      )
                    })

                    // 소계 행
                    const subtotalRow = (
                      <tr key={`${key}-subtotal`} className="bg-slate-100 border-b-2 border-slate-300">
                        <td className="p-2 font-semibold text-slate-700 bg-slate-100">계</td>
                        {evaluationItems.map((item) => {
                          const subtotal = tenureCategories.reduce(
                            (sum, tenure) => sum + (tenureData[key]?.[tenure]?.[item.id] || 0),
                            0,
                          )
                          return (
                            <td key={`${key}-subtotal-${item.id}`} className="p-2 text-center font-semibold text-slate-700">
                              {subtotal}
                            </td>
                          )
                        })}
                        <td className="p-2 text-center font-bold text-slate-800 bg-[#2c6edb]/10">
                          {tenureCategories.reduce(
                            (sum, tenure) =>
                              sum +
                              evaluationItems
                                .slice(0, 8)
                                .reduce((s, item) => s + (tenureData[key]?.[tenure]?.[item.id] || 0), 0),
                            0,
                          )}
                        </td>
                      </tr>
                    )

                    return [...tenureRows, subtotalRow]
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
        )}
    </div>
  )
}
