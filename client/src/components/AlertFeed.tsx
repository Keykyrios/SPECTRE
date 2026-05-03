'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnalysisResult, THREAT_COLORS, THREAT_LABELS, ThreatType } from '@/lib/types';
import { truncateHash, zscoreToPercent } from '@/lib/utils';

/* ─── Single Alert Card ─────────────────────────────────────────────────── */

interface AlertCardProps {
  result: AnalysisResult;
  index: number;
  maxVisible: number;
  isSelected: boolean;
  onClick: () => void;
}

function AlertCard({ result, index, maxVisible, isSelected, onClick }: AlertCardProps) {
  const color = THREAT_COLORS[result.threat] || THREAT_COLORS.CLEAN;
  const label = THREAT_LABELS[result.threat] || 'UNKNOWN';
  const zPct = zscoreToPercent(result.anomaly_score) * 100;
  const isThreat = result.threat !== 'CLEAN';

  // Calculate sinking state
  const age = index;
  const isSinking = age > maxVisible - 5;
  const sinkOpacity = isSinking ? Math.max(0, 1 - (age - (maxVisible - 5)) / 5) : 1;
  const sinkTranslate = isSinking ? (age - (maxVisible - 5)) * 4 : 0;

  return (
    <div
      onClick={onClick}
      className={`threat-card card-enter`}
      style={
        {
          '--card-glow': color,
          padding: '10px 12px',
          marginBottom: '6px',
          opacity: sinkOpacity,
          transform: `translateY(${sinkTranslate}px)`,
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          background: isSelected ? 'rgba(10,61,107,0.4)' : 'rgba(7,13,20,0.4)',
          border: isSelected ? `1px solid ${color}` : '1px solid rgba(10,61,107,0.3)',
          boxShadow: isThreat || isSelected
            ? `inset 0 0 15px rgba(${hexToRgb(color)}, ${isSelected ? '0.2' : '0.08'})`
            : 'none',
        } as React.CSSProperties
      }
    >
      {/* Row 1: Hash + Label */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span
          className="font-mono"
          style={{
            fontSize: '10px',
            color: isSelected ? '#ffffff' : 'rgba(192,200,212,0.55)',
            letterSpacing: '0.03em',
          }}
          title={result.txid}
        >
          {truncateHash(result.txid, 6)}
        </span>
        <span
          className="font-display text-wide"
          style={{
            fontSize: '9px',
            fontWeight: 700,
            color: color,
            textTransform: 'uppercase',
            textShadow: isThreat || isSelected ? `0 0 8px rgba(${hexToRgb(color)}, 0.4)` : 'none',
          }}
        >
          {label}
        </span>
      </div>

      {/* Row 2: Z-Score Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <div className="zscore-bar" style={{ flex: 1 }}>
          <div
            className="zscore-bar-fill"
            style={{
              width: `${Math.min(zPct, 100)}%`,
              background: `linear-gradient(90deg, ${color}88, ${color})`,
              boxShadow: `0 0 6px ${color}44`,
            }}
          />
        </div>
        <span
          className="font-mono"
          style={{
            fontSize: '9px',
            color: color,
            fontWeight: 600,
            minWidth: '36px',
            textAlign: 'right',
          }}
        >
          {result.anomaly_score > 0 ? '+' : ''}{result.anomaly_score.toFixed(2)}
        </span>
      </div>

      {/* Row 3: Entropy + Latency */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span
          className="font-mono"
          style={{ fontSize: '9px', color: 'rgba(192,200,212,0.3)' }}
        >
          H={result.entropy.toFixed(2)} bits
        </span>
        <span
          className="font-mono"
          style={{ fontSize: '9px', color: 'rgba(192,200,212,0.2)' }}
        >
          {result.analysis_time_us}μs
        </span>
      </div>

      {/* Row 4: Raw Mem Dump Simulation */}
      <div 
        className="font-mono" 
        style={{ 
          fontSize: '7px', 
          color: isThreat ? color : 'rgba(192,200,212,0.15)', 
          opacity: 0.6,
          background: 'rgba(0,0,0,0.3)',
          padding: '2px 4px',
          borderRadius: '2px',
          letterSpacing: '0.1em'
        }}
      >
        {result.txid.slice(0, 16).match(/.{1,4}/g)?.join(' ')} ...
      </div>

      {/* CoinJoin confidence if relevant */}
      {result.coinjoin_confidence > 0.1 && (
        <div style={{ marginTop: '3px' }}>
          <span
            className="font-mono"
            style={{ fontSize: '9px', color: '#FF1E56', opacity: 0.7 }}
          >
            CJ:{(result.coinjoin_confidence * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── Alert Feed (Right Column — The Ledger) ────────────────────────────── */

interface AlertFeedProps {
  events: AnalysisResult[];
  selectedTx: string | null;
  onSelectTx: (txid: string | null) => void;
}

export default function AlertFeed({ events, selectedTx, onSelectTx }: AlertFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const MAX_VISIBLE = 40;
  const displayed = events.slice(0, MAX_VISIBLE);

  return (
    <div className="spectre-ledger" ref={scrollRef}>
      {/* Section label */}
      <div
        className="font-display text-wide"
        style={{
          fontSize: '9px',
          color: 'rgba(192,200,212,0.3)',
          textTransform: 'uppercase',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid rgba(10,61,107,0.15)',
        }}
      >
        LIVE EVENT LEDGER
      </div>

      {/* Event cards */}
      {displayed.length === 0 && (
        <div
          className="font-mono"
          style={{
            fontSize: '11px',
            color: 'rgba(192,200,212,0.2)',
            textAlign: 'center',
            paddingTop: '40px',
          }}
        >
          Awaiting mempool data...
        </div>
      )}

      {displayed.map((event, i) => (
        <AlertCard
          key={`${event.txid}-${i}-${event.analysis_time_us}`}
          result={event}
          index={i}
          maxVisible={MAX_VISIBLE}
          isSelected={selectedTx === event.txid}
          onClick={() => onSelectTx(selectedTx === event.txid ? null : event.txid)}
        />
      ))}
    </div>
  );
}

/* ─── Utility ───────────────────────────────────────────────────────────── */

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
