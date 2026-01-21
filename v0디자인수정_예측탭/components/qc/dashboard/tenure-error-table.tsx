"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { evaluationItems, serviceGroups, channelTypes, tenureCategories } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

// 근속기간별 데이터 생성
const generateTenureData = () => {
  const data: Record<string, Record<string, Record<string, number>>> = {}

  const allServices = [
    ...serviceGroups["용산"].map((s) => ({ center: "용산", service: s })),
    ...serviceGroups["광주"].map((s) => ({ center: "광주", service: s })),
  ]

  allServices.forEach(({ center, service }) => {
    channelTypes.forEach((channel) => {
      const key = `${center}-${service}-${channel}`
      data[key] = {}

      tenureCategories.forEach((tenure) => {
        data[key][tenure] = {}
        evaluationItems.forEach((item) => {
          data[key][tenure][item.id] = Math.floor(Math.random() * 10)
        })
      })
    })
  })

  return data
}

export function TenureErrorTable() {
  const [selectedCenter, setSelectedCenter] = useState<"all" | "용산" | "광주">("all")
  const [selectedService, setSelectedService] = useState("all")
  const tenureData = generateTenureData()

  const services =
    selectedCenter === "all"
      ? [...new Set([...serviceGroups["용산"], ...serviceGroups["광주"]])]
      : serviceGroups[selectedCenter]

  // 필터링된 키 목록
  const filteredKeys = Object.keys(tenureData).filter((key) => {
    const [center, service] = key.split("-")
    if (selectedCenter !== "all" && center !== selectedCenter) return false
    if (selectedService !== "all" && service !== selectedService) return false
    return true
  })

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg font-semibold text-slate-800">근속기간별 오류 현황</CardTitle>
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
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-[#1e3a5f]/5">
                <th className="sticky left-0 bg-[#1e3a5f]/5 text-left p-2 font-medium text-slate-700" colSpan={2}>
                  구분
                </th>
                {evaluationItems.slice(0, 8).map((item) => (
                  <th key={item.id} className="p-2 font-medium text-slate-600 text-center whitespace-nowrap">
                    <span
                      className={cn(
                        "inline-block w-2 h-2 rounded-full mr-1",
                        item.category === "상담태도" ? "bg-[#1e3a5f]" : "bg-[#f9e000]",
                      )}
                    />
                    {item.shortName}
                  </th>
                ))}
                <th className="p-2 font-semibold text-slate-800 text-center bg-[#1e3a5f]/10">합계</th>
              </tr>
            </thead>
            <tbody>
              {filteredKeys.map((key, keyIdx) => {
                const [center, service, channel] = key.split("-")
                const tenureRows = tenureCategories.map((tenure, tenureIdx) => {
                  const rowData = tenureData[key][tenure]
                  const total = evaluationItems.slice(0, 8).reduce((sum, item) => sum + (rowData[item.id] || 0), 0)

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
                            center === "용산" ? "bg-[#1e3a5f]/10" : "bg-[#f9e000]/20",
                          )}
                        >
                          {service} {channel}
                        </td>
                      )}
                      <td className="p-2 text-slate-600 bg-slate-50">{tenure}</td>
                      {evaluationItems.slice(0, 8).map((item) => (
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
                    {evaluationItems.slice(0, 8).map((item) => {
                      const subtotal = tenureCategories.reduce(
                        (sum, tenure) => sum + (tenureData[key][tenure][item.id] || 0),
                        0,
                      )
                      return (
                        <td key={`${key}-subtotal-${item.id}`} className="p-2 text-center font-semibold text-slate-700">
                          {subtotal}
                        </td>
                      )
                    })}
                    <td className="p-2 text-center font-bold text-slate-800 bg-[#1e3a5f]/10">
                      {tenureCategories.reduce(
                        (sum, tenure) =>
                          sum +
                          evaluationItems
                            .slice(0, 8)
                            .reduce((s, item) => s + (tenureData[key][tenure][item.id] || 0), 0),
                        0,
                      )}
                    </td>
                  </tr>
                )

                return [...tenureRows, subtotalRow]
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
