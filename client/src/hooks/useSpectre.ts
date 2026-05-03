'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AnalysisResult,
  PipelineStats,
  WsMessage,
} from '@/lib/types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';
const RECONNECT_DELAY = 3000;
const MAX_EVENTS = 100;

export interface SpectreState {
  connected: boolean;
  events: AnalysisResult[];
  stats: PipelineStats;
  latestEvent: AnalysisResult | null;
  connectionAttempts: number;
}

const DEFAULT_STATS: PipelineStats = {
  tx_total: 0,
  threats_detected: 0,
  tx_per_second: 0,
  pq_status: 'initializing',
};

export function useSpectre() {
  const [state, setState] = useState<SpectreState>({
    connected: false,
    events: [],
    stats: DEFAULT_STATS,
    latestEvent: null,
    connectionAttempts: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const pingTimer = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setState(prev => ({
          ...prev,
          connected: true,
          connectionAttempts: 0,
        }));

        // Start ping keepalive
        pingTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);

          if (msg.type === 'analysis') {
            setState(prev => {
              const newEvents = [msg.result, ...prev.events].slice(0, MAX_EVENTS);
              return {
                ...prev,
                events: newEvents,
                stats: { ...prev.stats, ...msg.stats },
                latestEvent: msg.result,
              };
            });
          } else if (msg.type === 'snapshot') {
            setState(prev => ({
              ...prev,
              stats: { ...prev.stats, ...msg.stats },
              events: msg.recent.reverse(),
            }));
          }
        } catch (e) {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        setState(prev => ({ ...prev, connected: false }));
        if (pingTimer.current) clearInterval(pingTimer.current);

        // Auto-reconnect
        reconnectTimer.current = setTimeout(() => {
          setState(prev => ({
            ...prev,
            connectionAttempts: prev.connectionAttempts + 1,
          }));
          connect();
        }, RECONNECT_DELAY);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      // Connection failed, will retry on close handler
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (pingTimer.current) clearInterval(pingTimer.current);
    };
  }, [connect]);

  return state;
}
