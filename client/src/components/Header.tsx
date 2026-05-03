'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const [time, setTime] = useState('');
  const [blink, setBlink] = useState(true);
  const [memAddr, setMemAddr] = useState('0x00000000');
  const pathname = usePathname();

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC');
      setBlink(prev => !prev);
      setMemAddr('0x' + Math.floor(Math.random() * 0xFFFFFFFF).toString(16).toUpperCase().padStart(8, '0'));
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="spectre-header">
      {/* Ambient horizontal line pulse */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(0,255,209,0.15) 30%, rgba(0,255,209,0.3) 50%, rgba(0,255,209,0.15) 70%, transparent)',
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          width: '100%',
          padding: '0 24px',
        }}
      >
        {/* Left: system tag */}
        <div style={{ position: 'absolute', left: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span
            className="font-mono"
            style={{
              color: 'rgba(192, 200, 212, 0.3)',
              fontSize: '10px',
              letterSpacing: '0.2em',
            }}
          >
            SYS::SPECTRE v1.0
          </span>
          <span className="font-mono glitch" data-text={memAddr} style={{ color: '#FF1E56', fontSize: '10px', opacity: 0.6 }}>
            {memAddr}
          </span>
          <span className="font-mono" style={{
            color: '#00FFD1',
            fontSize: '9px',
            border: '1px solid rgba(0,255,209,0.3)',
            padding: '2px 6px',
            background: 'rgba(0,255,209,0.05)',
            letterSpacing: '0.1em'
          }}>
            [ UPLINK SECURE ]
          </span>
        </div>

        {/* Centre marquee */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            className="font-display text-wide glitch"
            data-text="SPECTRE"
            style={{
              fontSize: '15px',
              fontWeight: 800,
              color: '#00FFD1',
              textTransform: 'uppercase',
              textShadow: '0 0 16px rgba(0,255,209,0.5)',
            }}
          >
            SPECTRE
          </span>
          <span
            style={{
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: '#00FFD1',
              opacity: blink ? 0.9 : 0.2,
              transition: 'opacity 0.3s',
              boxShadow: '0 0 6px rgba(0,255,209,0.5)',
            }}
          />
          <span
            className="font-display"
            style={{
              fontSize: '10px',
              fontWeight: 500,
              color: 'rgba(192, 200, 212, 0.5)',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
            }}
          >
            REAL-TIME POST-QUANTUM FINANCIAL INTELLIGENCE
          </span>
        </div>

        {/* Right: Navigation & UTC clock */}
        <div style={{ position: 'absolute', right: '24px', display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Link href="/" className="font-mono" style={{
              fontSize: '10px',
              letterSpacing: '0.1em',
              textDecoration: 'none',
              color: pathname === '/' ? '#00FFD1' : 'rgba(192, 200, 212, 0.4)',
              borderBottom: pathname === '/' ? '1px solid #00FFD1' : 'none',
              paddingBottom: '2px',
              transition: 'all 0.2s'
            }}>
              [ TACTICAL MAP ]
            </Link>
            <Link href="/engine" className="font-mono" style={{
              fontSize: '10px',
              letterSpacing: '0.1em',
              textDecoration: 'none',
              color: pathname === '/engine' ? '#FFD426' : 'rgba(192, 200, 212, 0.4)',
              borderBottom: pathname === '/engine' ? '1px solid #FFD426' : 'none',
              paddingBottom: '2px',
              transition: 'all 0.2s'
            }}>
              [ ENGINE DIAGNOSTICS ]
            </Link>
          </div>
          <span
            className="font-mono"
            style={{
              color: 'rgba(192, 200, 212, 0.35)',
              fontSize: '10px',
              letterSpacing: '0.08em',
            }}
          >
            {time}
          </span>
        </div>
      </div>
    </header>
  );
}
