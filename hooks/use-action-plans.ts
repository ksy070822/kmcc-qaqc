
"use client"

import { useState, useEffect, useCallback } from "react"
interface ActionPlan {
    id: string
    agentId: string
    agentName: string
    center: string
    group: string
    issue: string
    plan: string
    targetDate: string
    status: string
    result?: string
    improvement?: number
    createdAt: string
    managerFeedback?: string
    feedbackDate?: string
}

interface UseActionPlansOptions {
    center?: string
    status?: string
}

export function useActionPlans(options: UseActionPlansOptions = {}) {
    const [data, setData] = useState<ActionPlan[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchPlans = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const params = new URLSearchParams()
            if (options.center && options.center !== "all") params.append("center", options.center)
            if (options.status && options.status !== "all") params.append("status", options.status)

            const response = await fetch(`/api/action-plans?${params.toString()}`)
            const result = await response.json()

            if (result.success) {
                setData(result.data || [])
            } else {
                setError(result.error || "Failed to fetch action plans")
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error loading plans")
        } finally {
            setLoading(false)
        }
    }, [options.center, options.status])

    useEffect(() => {
        fetchPlans()
    }, [fetchPlans])

    const savePlan = async (plan: any) => {
        const response = await fetch("/api/action-plans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(plan),
        })
        const result = await response.json()
        if (result.success) {
            fetchPlans()
        } else {
            throw new Error(result.error)
        }
    }

    const updatePlan = async (id: string, updates: any) => {
        const response = await fetch("/api/action-plans", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, ...updates }),
        })
        const result = await response.json()
        if (result.success) {
            fetchPlans()
        } else {
            throw new Error(result.error)
        }
    }

    return { data, loading, error, refetch: fetchPlans, savePlan, updatePlan }
}
