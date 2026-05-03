import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SPECTRE — Real-Time Post-Quantum Financial Intelligence',
  description:
    'Live threat-intelligence platform monitoring blockchain mempools in real-time. Detects CoinJoins, peeling chains, and UTXO consolidation using high-speed C++ heuristics, secured with Post-Quantum Cryptography (Kyber-512 + AES-256-GCM).',
  keywords: [
    'blockchain',
    'mempool',
    'financial intelligence',
    'post-quantum',
    'cryptography',
    'Kyber-512',
    'CoinJoin detection',
    'AML',
    'threat intelligence',
    'real-time analytics',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#020408" />
        <meta name="color-scheme" content="dark" />
      </head>
      <body>{children}</body>
    </html>
  );
}
