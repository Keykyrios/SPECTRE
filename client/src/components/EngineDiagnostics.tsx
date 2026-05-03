'use client';

import React, { useEffect, useState } from 'react';
import Header from '@/components/Header';

function generateRandomHex(length: number) {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase();
}

function generateMemoryBlock() {
  const address = '0x' + generateRandomHex(12);
  const data = Array.from({ length: 8 }, () => generateRandomHex(4)).join(' ');
  const ascii = Array.from({ length: 16 }, () => {
    const c = Math.floor(Math.random() * 94) + 33;
    return String.fromCharCode(c);
  }).join('').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<span style="color: #6c7a89">${address}</span>  <span style="color: #FF1E56">${data}</span>  <span style="color: #00FFD1">|${ascii}|</span>`;
}

export default function EngineDiagnostics() {
  const [memoryLines, setMemoryLines] = useState<string[]>([]);
  const [threads, setThreads] = useState<any[]>(Array.from({ length: 16 }, (_, i) => ({ id: i, state: 'WAIT', load: 0 })));
  const [entropy, setEntropy] = useState<number[]>(Array.from({ length: 64 }, () => Math.random()));
  const [allocs, setAllocs] = useState({ malloc: 1048576, free: 1048000, leaked: 576 });

  useEffect(() => {
    // Generate initial memory block
    setMemoryLines(Array.from({ length: 25 }, generateMemoryBlock));

    const id = setInterval(() => {
      // Rotate memory lines
      setMemoryLines(prev => {
        const next = [...prev.slice(1), generateMemoryBlock()];
        return next;
      });

      // Update thread states
      setThreads(prev => prev.map(t => ({
        ...t,
        state: Math.random() > 0.8 ? (Math.random() > 0.5 ? 'COMPUTE' : 'LOCK') : 'WAIT',
        load: Math.random() > 0.8 ? Math.floor(Math.random() * 100) : Math.floor(t.load * 0.9)
      })));

      // Update entropy pool
      setEntropy(prev => [...prev.slice(1), Math.random()]);

      // Update allocs
      setAllocs(prev => ({
        malloc: prev.malloc + Math.floor(Math.random() * 50),
        free: prev.free + Math.floor(Math.random() * 48),
        leaked: prev.malloc - prev.free
      }));

    }, 80);

    return () => clearInterval(id);
  }, []);

  return (
    <div className="spectre-layout crt-flicker scanlines" style={{ display: 'flex', flexDirection: 'column' }}>
      <Header />
      
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 350px', overflow: 'hidden' }}>
        {/* Left Col: Memory Hex Dump */}
        <div style={{ padding: '24px', overflow: 'hidden', borderRight: '1px solid rgba(10, 61, 107, 0.2)', position: 'relative' }}>
          <div className="font-display text-wide" style={{ fontSize: '10px', color: '#00FFD1', marginBottom: '16px', letterSpacing: '0.2em' }}>
            [ C++ CORE :: DIRECT MEMORY ACCESS ]
          </div>
          <div 
            className="font-mono" 
            style={{ 
              fontSize: '11px', 
              lineHeight: 1.4, 
              color: 'rgba(192, 200, 212, 0.6)', 
              whiteSpace: 'pre-wrap' 
            }}
            dangerouslySetInnerHTML={{ __html: memoryLines.join('\n') }}
          />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100px', background: 'linear-gradient(transparent, #020408)' }} />
        </div>

        {/* Right Col: Thread / Engine Stats */}
        <div style={{ padding: '24px', overflowY: 'auto', background: '#070D14' }}>
          <div className="font-display text-wide" style={{ fontSize: '10px', color: '#FFD426', marginBottom: '24px', letterSpacing: '0.2em' }}>
            [ THREAD POOL SCHEDULER ]
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '32px' }}>
            {threads.map((t, i) => (
              <div key={i} style={{ 
                border: '1px solid ' + (t.state === 'COMPUTE' ? '#00FFD1' : t.state === 'LOCK' ? '#FF1E56' : '#0A3D6B'),
                background: t.state === 'COMPUTE' ? 'rgba(0,255,209,0.1)' : 'transparent',
                padding: '6px 8px',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span className="font-mono" style={{ fontSize: '9px', color: 'rgba(192,200,212,0.5)' }}>T-{t.id.toString().padStart(2, '0')}</span>
                <span className="font-mono" style={{ 
                  fontSize: '9px', 
                  color: t.state === 'COMPUTE' ? '#00FFD1' : t.state === 'LOCK' ? '#FF1E56' : 'rgba(192,200,212,0.3)' 
                }}>
                  {t.state} {t.state === 'COMPUTE' ? `${t.load}%` : ''}
                </span>
              </div>
            ))}
          </div>

          <div className="font-display text-wide" style={{ fontSize: '10px', color: '#FFD426', marginBottom: '16px', letterSpacing: '0.2em' }}>
            [ KYBER-512 ENTROPY POOL ]
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginBottom: '32px' }}>
            {entropy.map((e, i) => (
              <div key={i} style={{
                width: '12px', height: '12px',
                background: e > 0.8 ? '#FF1E56' : e > 0.5 ? '#FFD426' : '#00FFD1',
                opacity: 0.2 + (e * 0.8)
              }} />
            ))}
          </div>

          <div className="font-display text-wide" style={{ fontSize: '10px', color: '#FFD426', marginBottom: '16px', letterSpacing: '0.2em' }}>
            [ MEMORY ALLOCATOR (jemalloc) ]
          </div>
          <div className="font-mono" style={{ fontSize: '10px', color: 'rgba(192,200,212,0.6)', lineHeight: 1.8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>MALLOC_CALLS</span>
              <span style={{ color: '#00FFD1' }}>{allocs.malloc.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>FREE_CALLS</span>
              <span style={{ color: '#00FFD1' }}>{allocs.free.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>ACTIVE_PTRS</span>
              <span style={{ color: allocs.leaked > 1000 ? '#FF1E56' : '#FFD426' }}>{allocs.leaked.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>PAGE_FAULTS</span>
              <span style={{ color: 'rgba(192,200,212,0.3)' }}>14,203</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
