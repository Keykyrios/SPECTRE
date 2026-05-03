"""
Spectre WebSocket Server — Bridges the analysis pipeline to the 3D dashboard.
FastAPI application with WebSocket endpoint for real-time telemetry.
"""

import asyncio
import json
import time
import logging
from typing import Set, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .config import SpectreConfig
from .processor import SpectreProcessor
from .ingestor import DemoSimulator, MempoolIngestor
from .crypto import SecureChannel

logger = logging.getLogger("spectre.server")

app = FastAPI(title="Spectre Intelligence Server", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Global state ───────────────────────────────────────────────────────────

config = SpectreConfig()
processor = SpectreProcessor(
    alpha=config.ema_alpha,
    z_threshold=config.z_threshold,
    entropy_threshold=config.entropy_threshold,
    coinjoin_tolerance=config.coinjoin_tolerance,
)

connected_clients: Set[WebSocket] = set()
pipeline_stats: Dict[str, Any] = {
    "tx_total": 0,
    "threats_detected": 0,
    "tx_per_second": 0.0,
    "engine_type": processor.engine_type,
    "pq_status": "initializing",
    "uptime_seconds": 0,
    "start_time": time.time(),
    "ema_mean": 0.0,
    "ema_variance": 0.0,
    "threat_counts": {
        "CLEAN": 0, "PEELING_CHAIN": 0, "COINJOIN": 0,
        "CONSOLIDATION": 0, "FEE_ANOMALY": 0,
        "HIGH_ENTROPY": 0, "MULTI_THREAT": 0
    }
}

# Recent results buffer for new client catch-up
recent_results: list = []
MAX_RECENT = 50


async def broadcast(message: dict):
    """Send a message to all connected WebSocket clients."""
    global connected_clients
    if not connected_clients:
        return
    data = json.dumps(message)
    disconnected = set()
    for ws in connected_clients:
        try:
            await ws.send_text(data)
        except Exception:
            disconnected.add(ws)
    connected_clients -= disconnected


# ─── WebSocket endpoint ─────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    connected_clients.add(ws)
    logger.info(f"Client connected ({len(connected_clients)} total)")

    # Send current state snapshot
    try:
        await ws.send_text(json.dumps({
            "type": "snapshot",
            "stats": pipeline_stats,
            "recent": recent_results[-MAX_RECENT:]
        }))
    except Exception:
        pass

    try:
        while True:
            # Keep connection alive; handle any client messages
            data = await ws.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        pass
    finally:
        connected_clients.discard(ws)
        logger.info(f"Client disconnected ({len(connected_clients)} total)")


# ─── REST endpoints ─────────────────────────────────────────────────────────

@app.get("/api/stats")
async def get_stats():
    pipeline_stats["uptime_seconds"] = int(time.time() - pipeline_stats["start_time"])
    return pipeline_stats


@app.get("/api/health")
async def health():
    return {"status": "operational", "engine": processor.engine_type}


# ─── Pipeline loop ──────────────────────────────────────────────────────────

async def run_pipeline():
    """Main ingestion → analysis → broadcast loop."""
    logger.info(f"Starting pipeline (mode={'demo' if config.demo_mode else 'live'})")

    # Initialize PQ channel
    pq_channel = SecureChannel()
    handshake = pq_channel.create_handshake()
    # Self-accept for demo (in production, client would respond)
    response = pq_channel.accept_handshake(handshake)
    pq_channel_client = SecureChannel()
    pq_channel_client._session_key = pq_channel._session_key  # Simulated exchange
    pipeline_stats["pq_status"] = "active"
    pipeline_stats["pq_algorithm"] = handshake.get("algorithm", "Kyber-512")

    logger.info(f"PQ channel: {handshake.get('algorithm')}")

    # Choose data source
    if config.demo_mode:
        source = DemoSimulator(interval=config.demo_tx_interval)
    else:
        source = MempoolIngestor(
            ws_url=config.btc_ws_url if config.chain == "btc" else config.eth_ws_url,
            chain=config.chain
        )

    tx_times = []
    async for tx_raw in source.stream():
        now = time.time()
        tx_times.append(now)
        # Keep only last 10s of timestamps for rate calculation
        tx_times = [t for t in tx_times if now - t < 10.0]

        # Run C++ analysis
        result = processor.analyze(tx_raw)

        # Update stats
        pipeline_stats["tx_total"] += 1
        pipeline_stats["tx_per_second"] = round(len(tx_times) / 10.0, 2)
        pipeline_stats["ema_mean"] = round(
            result.get("anomaly_score", 0), 4
        )
        threat = result["threat"]
        if threat != "CLEAN":
            pipeline_stats["threats_detected"] += 1
        pipeline_stats["threat_counts"][threat] = \
            pipeline_stats["threat_counts"].get(threat, 0) + 1

        # Buffer for catch-up
        recent_results.append(result)
        if len(recent_results) > MAX_RECENT:
            recent_results.pop(0)

        # Broadcast to all connected dashboards
        await broadcast({
            "type": "analysis",
            "result": result,
            "stats": {
                "tx_total": pipeline_stats["tx_total"],
                "threats_detected": pipeline_stats["threats_detected"],
                "tx_per_second": pipeline_stats["tx_per_second"],
                "pq_status": pipeline_stats["pq_status"],
            }
        })


@app.on_event("startup")
async def startup():
    asyncio.create_task(run_pipeline())
    logger.info("Spectre server started")
