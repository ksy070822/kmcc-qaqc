"use client"

import { useState, useCallback } from 'react';
import { AIChatMessage, AIChatRequest, AIChatResponse } from '@/lib/types';

interface UseAIChatOptions {
  agentId?: string;
  group?: {
    center?: string;
    service?: string;
    channel?: string;
  };
  context?: Record<string, any>;
}

export function useAIChat(options: UseAIChatOptions = {}) {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (message: string) => {
      // 중복 요청 방지
      if (!message.trim() || loading) return;
      
      // 메시지 길이 검증 (프론트엔드에서도 체크)
      if (message.length > 5000) {
        setError('메시지가 너무 깁니다 (최대 5,000자). 메시지를 단축해주세요.');
        return;
      }

      // 사용자 메시지 추가
      const userMessage: AIChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);
      setError(null);

      try {
        const request: AIChatRequest = {
          message,
          agentId: options.agentId,
          group: options.group,
          context: options.context,
          conversationHistory: messages,
        };

        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });

        const data: AIChatResponse = await response.json();

        if (!data.success) {
          // Rate limit 오류인 경우 특별 처리
          if (response.status === 429) {
            throw new Error(data.error || '요청 빈도가 너무 높습니다. 잠시 후 다시 시도해주세요.');
          }
          throw new Error(data.error || 'AI 응답 생성에 실패했습니다.');
        }

        // AI 응답 추가
        const aiMessage: AIChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.message || '',
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiMessage]);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
        setError(errorMessage);
        
        // 에러 메시지 추가
        const errorAiMessage: AIChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `오류: ${errorMessage}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorAiMessage]);
      } finally {
        setLoading(false);
      }
    },
    [options.agentId, options.group, options.context, messages, loading]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const triggerAutoAnalysis = useCallback(
    async () => {
      if (loading) return;
      
      // 자동 분석 메시지
      const autoMessage = options.agentId 
        ? "이 상담사의 최근 1개월간 추이, 강점, 약점, 코칭 제안, 주의사항을 종합적으로 분석해주세요."
        : options.group
        ? "이 그룹의 최근 1개월간 추이, 강점, 약점, 코칭 제안, 주의사항을 종합적으로 분석해주세요."
        : null;

      if (!autoMessage) return;

      await sendMessage(autoMessage);
    },
    [options.agentId, options.group, sendMessage, loading]
  );

  return {
    messages,
    loading,
    error,
    sendMessage,
    clearMessages,
    triggerAutoAnalysis,
  };
}
