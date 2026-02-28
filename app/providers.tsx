'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,    // 5분 캐시
        gcTime: 10 * 60 * 1000,       // 10분 GC
        retry: 1,
        refetchOnWindowFocus: true,
      },
    },
  }))
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
