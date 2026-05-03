/* ─── Threat Classification ─────────────────────────────────────────────── */

export type ThreatType =
  | 'CLEAN'
  | 'PEELING_CHAIN'
  | 'COINJOIN'
  | 'CONSOLIDATION'
  | 'FEE_ANOMALY'
  | 'HIGH_ENTROPY'
  | 'MULTI_THREAT';

/* ─── Analysis Result from C++ Engine ───────────────────────────────────── */

export interface AnalysisResult {
  txid: string;
  threat: ThreatType;
  anomaly_score: number;
  entropy: number;
  coinjoin_confidence: number;
  is_peeling: boolean;
  is_consolidation: boolean;
  analysis_time_us: number;
  source_addresses: string[];
  dest_addresses: string[];
  output_values: number[];
}

/* ─── Pipeline Statistics ───────────────────────────────────────────────── */

export interface PipelineStats {
  tx_total: number;
  threats_detected: number;
  tx_per_second: number;
  pq_status: 'initializing' | 'active' | 'dead';
  engine_type?: string;
  pq_algorithm?: string;
  uptime_seconds?: number;
  ema_mean?: number;
  ema_variance?: number;
  threat_counts?: Record<ThreatType, number>;
}

/* ─── WebSocket Messages ────────────────────────────────────────────────── */

export interface WsAnalysisMessage {
  type: 'analysis';
  result: AnalysisResult;
  stats: PipelineStats;
}

export interface WsSnapshotMessage {
  type: 'snapshot';
  stats: PipelineStats;
  recent: AnalysisResult[];
}

export type WsMessage = WsAnalysisMessage | WsSnapshotMessage | { type: 'pong' };

/* ─── Graph Node for Three.js ───────────────────────────────────────────── */

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  z: number;
  threat: ThreatType;
  size: number;
  age: number;          // ms since creation
  emerging: boolean;    // still in spawn animation
  pulsing: boolean;     // heartbeat after anomaly
}

export interface GraphEdge {
  source: string;
  target: string;
  value: number;
  txid: string;
  threat: ThreatType;
}

/* ─── Colour Mapping ────────────────────────────────────────────────────── */

export const THREAT_COLORS: Record<ThreatType, string> = {
  CLEAN:         '#00FFD1',
  HIGH_ENTROPY:  '#7BFF6A',
  CONSOLIDATION: '#FFD426',
  PEELING_CHAIN: '#FF6B35',
  COINJOIN:      '#FF1E56',
  FEE_ANOMALY:   '#FF1E56',
  MULTI_THREAT:  '#FF1E56',
};

export const THREAT_LABELS: Record<ThreatType, string> = {
  CLEAN:         'CLEAN',
  HIGH_ENTROPY:  'HIGH ENTROPY',
  CONSOLIDATION: 'CONSOLIDATION',
  PEELING_CHAIN: 'PEELING CHAIN',
  COINJOIN:      'COINJOIN',
  FEE_ANOMALY:   'FEE ANOMALY',
  MULTI_THREAT:  'MULTI-THREAT',
};

export const THREAT_SEVERITY: Record<ThreatType, number> = {
  CLEAN:         0,
  HIGH_ENTROPY:  1,
  CONSOLIDATION: 2,
  PEELING_CHAIN: 3,
  COINJOIN:      4,
  FEE_ANOMALY:   4,
  MULTI_THREAT:  5,
};
