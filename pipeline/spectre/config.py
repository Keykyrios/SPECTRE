"""
Spectre Configuration — Centralized configuration management.
"""

import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SpectreConfig:
    """Configuration for the Spectre pipeline."""

    # ── RPC / WebSocket endpoints ────────────────────────────────────────────
    btc_ws_url: str = os.getenv(
        "SPECTRE_BTC_WS_URL",
        "wss://ws.blockchain.info/inv"
    )
    eth_ws_url: str = os.getenv(
        "SPECTRE_ETH_WS_URL",
        "wss://mainnet.infura.io/ws/v3/demo"
    )

    # Which chain to monitor: "btc" or "eth"
    chain: str = os.getenv("SPECTRE_CHAIN", "btc")

    # ── C++ Engine parameters ────────────────────────────────────────────────
    ema_alpha: float = float(os.getenv("SPECTRE_EMA_ALPHA", "0.05"))
    z_threshold: float = float(os.getenv("SPECTRE_Z_THRESHOLD", "3.0"))
    entropy_threshold: float = float(os.getenv("SPECTRE_ENTROPY_THRESHOLD", "3.5"))
    coinjoin_tolerance: float = float(os.getenv("SPECTRE_COINJOIN_TOLERANCE", "0.01"))

    # ── Server configuration ────────────────────────────────────────────────
    ws_server_host: str = os.getenv("SPECTRE_WS_HOST", "0.0.0.0")
    ws_server_port: int = int(os.getenv("SPECTRE_WS_PORT", "8765"))
    api_host: str = os.getenv("SPECTRE_API_HOST", "0.0.0.0")
    api_port: int = int(os.getenv("SPECTRE_API_PORT", "8000"))

    # ── Post-Quantum Crypto ─────────────────────────────────────────────────
    pq_enabled: bool = os.getenv("SPECTRE_PQ_ENABLED", "true").lower() == "true"
    pq_kem_algorithm: str = os.getenv("SPECTRE_PQ_KEM", "kyber512")

    # ── Demo / simulation mode ──────────────────────────────────────────────
    demo_mode: bool = os.getenv("SPECTRE_DEMO_MODE", "true").lower() == "true"
    demo_tx_interval: float = float(os.getenv("SPECTRE_DEMO_INTERVAL", "0.5"))

    # ── Logging ─────────────────────────────────────────────────────────────
    log_level: str = os.getenv("SPECTRE_LOG_LEVEL", "INFO")
