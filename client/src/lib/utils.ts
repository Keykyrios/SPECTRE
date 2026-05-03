import { ThreatType, THREAT_COLORS } from './types';

/** Truncate a tx hash for display: abcdef...xyz123 */
export function truncateHash(hash: string, chars: number = 8): string {
  if (hash.length <= chars * 2 + 3) return hash;
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
}

/** Format satoshis to BTC string */
export function satsToBtc(sats: number): string {
  return (sats / 1e8).toFixed(8);
}

/** Format large numbers with commas */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/** Get CSS color for a threat type */
export function getThreatColor(threat: ThreatType): string {
  return THREAT_COLORS[threat] || THREAT_COLORS.CLEAN;
}

/** Clamp value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Map a Z-score to a 0–1 bar fill percentage */
export function zscoreToPercent(z: number, maxZ: number = 6): number {
  return clamp(Math.abs(z) / maxZ, 0, 1);
}

/** Time ago string from unix ms timestamp */
export function timeAgo(timestampMs: number): string {
  const seconds = Math.floor((Date.now() - timestampMs) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

/** Generate a deterministic position from a hash string */
export function hashToPosition(hash: string, spread: number = 50): [number, number, number] {
  let h1 = 0, h2 = 0, h3 = 0;
  for (let i = 0; i < hash.length; i++) {
    const c = hash.charCodeAt(i);
    h1 = ((h1 << 5) - h1 + c) | 0;
    h2 = ((h2 << 7) - h2 + c) | 0;
    h3 = ((h3 << 3) - h3 + c) | 0;
  }
  const norm = (v: number) => ((v % 1000) / 1000) * spread * 2 - spread;
  return [norm(h1), norm(h2), norm(h3)];
}
