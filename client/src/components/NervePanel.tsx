'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { PipelineStats } from '@/lib/types';

/* ─── Waveform Visualizer ───────────────────────────────────────────────── */

function Waveform({ rate }: { rate: number }) {
  const bars = 20;
  const [heights, setHeights] = useState<number[]>(Array(bars).fill(5));

  useEffect(() => {
    const id = setInterval(() => {
      setHeights(prev =>
        prev.map((_, i) => {
          const base = Math.max(4, Math.min(55, rate * 15));
          const noise = Math.sin(Date.now() / 200 + i * 0.7) * 12;
          const rand = Math.random() * 10;
          return Math.max(2, base + noise + rand);
        })
      );
    }, 120);
    return () => clearInterval(id);
  }, [rate]);

  return (
    <div className="waveform-container">
      {heights.map((h, i) => (
        <div
          key={i}
          className="waveform-bar"
          style={{
            height: `${h}px`,
            opacity: 0.5 + (h / 60) * 0.5,
            background: h > 40 ? '#FF1E56' : h > 28 ? '#FFD426' : '#00FFD1',
          }}
        />
      ))}
    </div>
  );
}

/* ─── Sparkline ─────────────────────────────────────────────────────────── */

function Sparkline({ values }: { values: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || values.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    ctx.beginPath();
    ctx.strokeStyle = '#0E6BA8';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';

    values.forEach((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Glow
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(14, 107, 168, 0.3)';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    values.forEach((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [values]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={40}
      style={{ width: '100%', height: '40px' }}
    />
  );
}

/* ─── Kyber Badge ───────────────────────────────────────────────────────── */

function KyberBadge({ status }: { status: string }) {
  const isActive = status === 'active';
  const [showRipple, setShowRipple] = useState(false);
  const prevStatus = useRef(status);

  useEffect(() => {
    if (prevStatus.current !== 'active' && status === 'active') {
      setShowRipple(true);
      setTimeout(() => setShowRipple(false), 2000);
    }
    prevStatus.current = status;
  }, [status]);

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div className={`kyber-badge ${isActive ? 'active' : 'dead'}`}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 1L12.5 4.5V9.5L7 13L1.5 9.5V4.5L7 1Z"
            stroke={isActive ? '#C9A84C' : '#3a3a3a'}
            strokeWidth="1.2"
            fill={isActive ? 'rgba(201,168,76,0.15)' : 'none'}
          />
        </svg>
      </div>
      {showRipple && <div className="kyber-ripple" />}
      <div>
        <div
          className="font-mono"
          style={{
            fontSize: '9px',
            color: 'rgba(192,200,212,0.4)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          KYBER-512
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: '10px',
            color: isActive ? '#C9A84C' : '#3a3a3a',
            fontWeight: 600,
          }}
        >
          {isActive ? 'PQ TUNNEL LIVE' : 'OFFLINE'}
        </div>
      </div>
    </div>
  );
}

/* ─── Nerve Panel (Left Column) ─────────────────────────────────────────── */

interface NervePanelProps {
  stats: PipelineStats;
  anomalyHistory: number[];
}

export default function NervePanel({ stats, anomalyHistory }: NervePanelProps) {
  const nodeCount = stats.tx_total;
  const digits = String(nodeCount).padStart(6, '0');

  return (
    <div className="spectre-nerve crt-banding" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Section label */}
      <div
        className="font-display text-wide"
        style={{
          fontSize: '9px',
          color: 'rgba(192,200,212,0.3)',
          textTransform: 'uppercase',
          marginBottom: '-8px',
        }}
      >
        SYSTEM NERVE
      </div>

      {/* Mempool Ingestion Rate — Waveform */}
      <div>
        <div
          className="font-mono"
          style={{
            fontSize: '9px',
            color: 'rgba(192,200,212,0.4)',
            letterSpacing: '0.12em',
            marginBottom: '8px',
            textTransform: 'uppercase',
          }}
        >
          INGESTION RATE
        </div>
        <Waveform rate={stats.tx_per_second} />
        <div
          className="font-mono"
          style={{ fontSize: '10px', color: '#00FFD1', marginTop: '4px' }}
        >
          {stats.tx_per_second.toFixed(1)} tx/s
        </div>
      </div>

      {/* Active Node Count — 7-Segment */}
      <div>
        <div
          className="font-mono"
          style={{
            fontSize: '9px',
            color: 'rgba(192,200,212,0.4)',
            letterSpacing: '0.12em',
            marginBottom: '6px',
            textTransform: 'uppercase',
          }}
        >
          TRANSACTIONS PROCESSED
        </div>
        <div className="scanlines" style={{ padding: '8px 0', position: 'relative' }}>
          <div className="segment-display">
            {digits.split('').map((d, i) => (
              <span key={i} style={{ opacity: i < digits.length - String(nodeCount).length ? 0.15 : 1 }}>
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Kyber-512 Status */}
      <div>
        <div
          className="font-mono"
          style={{
            fontSize: '9px',
            color: 'rgba(192,200,212,0.4)',
            letterSpacing: '0.12em',
            marginBottom: '8px',
            textTransform: 'uppercase',
          }}
        >
          PQ ENCRYPTION
        </div>
        <KyberBadge status={stats.pq_status} />
      </div>

      {/* Threats Detected */}
      <div>
        <div
          className="font-mono"
          style={{
            fontSize: '9px',
            color: 'rgba(192,200,212,0.4)',
            letterSpacing: '0.12em',
            marginBottom: '6px',
            textTransform: 'uppercase',
          }}
        >
          THREATS DETECTED
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: '1.6rem',
            fontWeight: 700,
            color: stats.threats_detected > 0 ? '#FF1E56' : 'rgba(192,200,212,0.2)',
            textShadow: stats.threats_detected > 0 ? '0 0 10px rgba(255,30,86,0.3)' : 'none',
            lineHeight: 1,
          }}
        >
          {String(stats.threats_detected).padStart(4, '0')}
        </div>
      </div>

      {/* EMA Threat Baseline — Sparkline */}
      <div>
        <div
          className="font-mono"
          style={{
            fontSize: '9px',
            color: 'rgba(192,200,212,0.4)',
            letterSpacing: '0.12em',
            marginBottom: '8px',
            textTransform: 'uppercase',
          }}
        >
          EMA THREAT BASELINE
        </div>
        <div className="sparkline-container">
          <Sparkline values={anomalyHistory} />
        </div>
      </div>

      {/* Engine Info */}
      <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(10,61,107,0.15)' }}>
        <div
          className="font-mono"
          style={{
            fontSize: '9px',
            color: 'rgba(192,200,212,0.25)',
            letterSpacing: '0.08em',
          }}
        >
          ENGINE: {stats.engine_type || 'C++ (pybind11)'}
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: '9px',
            color: 'rgba(192,200,212,0.25)',
            letterSpacing: '0.08em',
            marginTop: '2px',
          }}
        >
          CRYPTO: AES-256-GCM + KYBER-512
        </div>
      </div>
    </div>
  );
}
