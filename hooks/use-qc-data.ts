import { useState, useEffect } from "react"

interface QCData {
  agents: any[]
  evaluations: any[]
  stats: {
    totalAgents: number
    totalEvaluations: number
    agentsByCenter: { 용산: number; 광주: number }
    evaluationsByCenter: { 용산: number; 광주: number }
  }
}

export function useQCData(center: string = "all") {
  const [data, setData] = useState<QCData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch(`/api/data?center=${center}`)
        const result = await response.json()
        
        if (result.success) {
          setData(result.data)
        } else {
          setError(result.error || "데이터를 불러올 수 없습니다.")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "데이터 로딩 실패")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    
    // 30초마다 자동 새로고침
    const interval = setInterval(fetchData, 30000)
    
    return () => clearInterval(interval)
  }, [center])

  return { data, loading, error, refetch: () => {
    setLoading(true)
    fetch(`/api/data?center=${center}`)
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setData(result.data)
        }
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  } }
}




