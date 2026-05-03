'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import NervePanel from '@/components/NervePanel';
import AlertFeed from '@/components/AlertFeed';
import { useSpectre } from '@/hooks/useSpectre';
import {
  AnalysisResult,
  PipelineStats,
  THREAT_COLORS,
  ThreatType,
} from '@/lib/types';
import { hashToPosition } from '@/lib/utils';

// Raw hex dump generator
function generateHexDump(lines: number) {
  let dump = '';
  for (let i = 0; i < lines; i++) {
    const addr = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(8, '0');
    const hex = Array.from({length: 8}, () => Math.floor(Math.random() * 0xFFFF).toString(16).padStart(4, '0')).join(' ');
    const ascii = Array.from({length: 16}, () => {
      const c = Math.floor(Math.random() * 94) + 33;
      return String.fromCharCode(c);
    }).join('').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    dump += `0x${addr}  ${hex}  |${ascii}|\n`;
  }
  return dump;
}

// Dynamic import for Three.js (no SSR)
const SpectreGraph = dynamic(() => import('@/components/SpectreGraph'), {
  ssr: false,
  loading: () => (
    <div
      className="spectre-void"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        className="font-display text-wide"
        style={{
          fontSize: '11px',
          color: 'rgba(0,255,209,0.3)',
          textTransform: 'uppercase',
          animation: 'breathing 4s ease-in-out infinite',
        }}
      >
        INITIALIZING VOID...
      </span>
    </div>
  ),
});

/* ═══════════════════════════════════════════════════════════════════════════
   DEMO DATA GENERATOR — Runs when backend is offline
   Produces realistic mempool analysis results for visual development
   ═══════════════════════════════════════════════════════════════════════════ */

const THREAT_TYPES: ThreatType[] = [
  'CLEAN', 'CLEAN', 'CLEAN', 'CLEAN', 'CLEAN', 'CLEAN', 'CLEAN', 'CLEAN',
  'PEELING_CHAIN', 'COINJOIN', 'CONSOLIDATION', 'FEE_ANOMALY', 'HIGH_ENTROPY',
  'MULTI_THREAT',
];

function randomHash(): string {
  const chars = '0123456789abcdef';
  let h = '';
  for (let i = 0; i < 64; i++) h += chars[Math.floor(Math.random() * 16)];
  return h;
}

function randomAddr(): string {
  const prefixes = ['1', '3', 'bc1q', 'bc1p'];
  return prefixes[Math.floor(Math.random() * prefixes.length)] + randomHash().slice(0, 32);
}

function generateDemoResult(): AnalysisResult {
  const threat = THREAT_TYPES[Math.floor(Math.random() * THREAT_TYPES.length)];
  const isThreat = threat !== 'CLEAN';

  const nSrc = threat === 'CONSOLIDATION' ? Math.floor(Math.random() * 8) + 5 :
    threat === 'COINJOIN' ? Math.floor(Math.random() * 6) + 3 :
    Math.floor(Math.random() * 2) + 1;
  const nDst = threat === 'COINJOIN' ? Math.floor(Math.random() * 8) + 5 :
    threat === 'PEELING_CHAIN' ? 2 :
    Math.floor(Math.random() * 3) + 1;

  return {
    txid: randomHash(),
    threat,
    anomaly_score: isThreat
      ? (Math.random() * 4 + 1) * (Math.random() > 0.5 ? 1 : -1)
      : (Math.random() - 0.5) * 1.5,
    entropy: threat === 'COINJOIN' || threat === 'HIGH_ENTROPY'
      ? 3.0 + Math.random() * 2
      : Math.random() * 2.5,
    coinjoin_confidence: threat === 'COINJOIN' ? 0.6 + Math.random() * 0.4 : Math.random() * 0.15,
    is_peeling: threat === 'PEELING_CHAIN',
    is_consolidation: threat === 'CONSOLIDATION',
    analysis_time_us: Math.floor(Math.random() * 200 + 10),
    source_addresses: Array.from({ length: nSrc }, randomAddr),
    dest_addresses: Array.from({ length: nDst }, randomAddr),
    output_values: Array.from(
      { length: nDst },
      () => Math.floor(Math.random() * 5000000 + 10000)
    ),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD — Main orchestrator
   ═══════════════════════════════════════════════════════════════════════════ */

export default function Dashboard() {
  const spectre = useSpectre();
  const [demoEvents, setDemoEvents] = useState<AnalysisResult[]>([]);
  const [demoStats, setDemoStats] = useState<PipelineStats>({
    tx_total: 0,
    threats_detected: 0,
    tx_per_second: 0,
    pq_status: 'active',
    engine_type: 'C++ (pybind11)',
    pq_algorithm: 'Kyber-512 (simulated)',
  });
  const [anomalyHistory, setAnomalyHistory] = useState<number[]>([]);
  const [demoLatest, setDemoLatest] = useState<AnalysisResult | null>(null);
  const [selectedTx, setSelectedTx] = useState<string | null>(null);

  // If backend is not connected, run demo data generator
  const isLive = spectre.connected;
  const events = isLive ? spectre.events : demoEvents;
  const stats = isLive ? spectre.stats : demoStats;
  const latestEvent = isLive ? spectre.latestEvent : demoLatest;

  // Boot sequence state
  const [bootStep, setBootStep] = useState<number>(0);
  const [hexDumpStr, setHexDumpStr] = useState<string>('');

  useEffect(() => {
    // Intense boot sequence
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setBootStep(step);
      if (step < 10) {
        setHexDumpStr(prev => prev + generateHexDump(2));
      }
      if (step > 15) {
        clearInterval(interval);
      }
    }, 150);
    return () => clearInterval(interval);
  }, []);

  // Demo mode data generation
  useEffect(() => {
    if (isLive) return;

    const id = setInterval(() => {
      const result = generateDemoResult();
      setDemoEvents(prev => [result, ...prev].slice(0, 100));
      setDemoLatest(result);
      setDemoStats(prev => ({
        ...prev,
        tx_total: prev.tx_total + 1,
        threats_detected: prev.threats_detected + (result.threat !== 'CLEAN' ? 1 : 0),
        tx_per_second: 1.5 + Math.random() * 2,
      }));
      setAnomalyHistory(prev => [...prev.slice(-59), result.anomaly_score]);
    }, 600 + Math.random() * 800);

    return () => clearInterval(id);
  }, [isLive]);

  // Track anomaly history from live data
  useEffect(() => {
    if (isLive && spectre.latestEvent) {
      setAnomalyHistory(prev =>
        [...prev.slice(-59), spectre.latestEvent!.anomaly_score]
      );
    }
  }, [isLive, spectre.latestEvent]);

  if (bootStep <= 15) {
    return (
      <div className="spectre-layout crt-flicker" style={{ background: '#000', color: '#00FFD1', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div className="font-mono" style={{ fontSize: '14px', whiteSpace: 'pre-wrap', textShadow: '0 0 10px #00FFD1' }}>
          {`[ SYSTEM KERNEL BOOT ]
> INIT SPECTRE ENGINE v1.0.0
> MOUNTING MEMPOOL TUNNEL... OK
> CALIBRATING KYBER-512 PQ... ` + (bootStep > 4 ? 'OK' : 'WAIT')}
          {bootStep > 6 && `\n> INJECTING THREAT HEURISTICS... OK`}
          {bootStep > 8 && `\n> CONNECTING ABYSS GRAPH... OK`}
        </div>
        <div className="hex-dump" style={{ marginTop: '20px', color: '#FF1E56' }} dangerouslySetInnerHTML={{ __html: hexDumpStr }} />
        {bootStep > 12 && (
          <div className="glitch font-display text-wide" data-text="ACCESS GRANTED" style={{ fontSize: '48px', color: '#fff', marginTop: '40px' }}>
            ACCESS GRANTED
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="spectre-layout crt-flicker scanlines">
      <Header />
      <NervePanel stats={stats} anomalyHistory={anomalyHistory} />
      <SpectreGraph 
        events={events} 
        latestEvent={latestEvent} 
        selectedTx={selectedTx}
        onSelectTx={setSelectedTx}
      />
      <AlertFeed 
        events={events} 
        selectedTx={selectedTx}
        onSelectTx={setSelectedTx}
      />

      {/* Connection status indicator */}
      {!isLive && (
        <div
          style={{
            position: 'fixed',
            top: '48px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
          }}
        >
          <div
            className="font-mono glitch"
            data-text="● DEMO MODE — Connect backend at ws://localhost:8000/ws"
            style={{
              fontSize: '9px',
              color: '#FF1E56',
              background: 'rgba(7,13,20,0.9)',
              padding: '3px 12px',
              borderRadius: '2px',
              border: '1px solid rgba(255,30,86,0.4)',
              letterSpacing: '0.1em',
              textShadow: '0 0 8px #FF1E56'
            }}
          >
            ● DEMO MODE — Connect backend at ws://localhost:8000/ws
          </div>
        </div>
      )}
    </div>
  );
}
