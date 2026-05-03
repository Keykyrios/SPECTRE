"""
Spectre Ingestor — Real-time mempool transaction ingestion.
Connects to Bitcoin/EVM nodes via WebSocket and streams raw transactions.
Includes a high-fidelity demo simulator for offline development.
"""

import asyncio
import json
import time
import random
import hashlib
import logging
from typing import AsyncGenerator, Dict, Any, Optional

logger = logging.getLogger("spectre.ingestor")


class MempoolIngestor:
    """WebSocket-based mempool transaction stream."""

    def __init__(self, ws_url: str, chain: str = "btc"):
        self.ws_url = ws_url
        self.chain = chain
        self._running = False

    async def stream(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Connect to node and yield raw transactions."""
        import websockets

        self._running = True
        logger.info(f"Connecting to {self.chain.upper()} mempool: {self.ws_url}")

        async with websockets.connect(self.ws_url) as ws:
            if self.chain == "btc":
                await ws.send(json.dumps({"op": "unconfirmed_sub"}))
            elif self.chain == "eth":
                await ws.send(json.dumps({
                    "jsonrpc": "2.0", "id": 1,
                    "method": "eth_subscribe",
                    "params": ["newPendingTransactions"]
                }))

            while self._running:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=30.0)
                    data = json.loads(msg)
                    tx = self._parse_tx(data)
                    if tx:
                        yield tx
                except asyncio.TimeoutError:
                    logger.debug("WebSocket heartbeat")
                    continue
                except Exception as e:
                    logger.error(f"Ingestion error: {e}")
                    await asyncio.sleep(1)

    def _parse_tx(self, data: dict) -> Optional[Dict[str, Any]]:
        """Parse raw WebSocket message into normalized transaction format."""
        if self.chain == "btc":
            return self._parse_btc(data)
        return self._parse_eth(data)

    def _parse_btc(self, data: dict) -> Optional[Dict[str, Any]]:
        if "x" not in data:
            return None
        tx = data["x"]
        inputs = []
        for inp in tx.get("inputs", []):
            prev = inp.get("prev_out", {})
            inputs.append({
                "prev_txid": prev.get("tx_index", ""),
                "prev_index": prev.get("n", 0),
                "address": prev.get("addr", "unknown"),
                "value": prev.get("value", 0)
            })

        outputs = []
        for i, out in enumerate(tx.get("out", [])):
            outputs.append({
                "address": out.get("addr", "unknown"),
                "value": out.get("value", 0),
                "index": i
            })

        total_in = sum(i["value"] for i in inputs)
        total_out = sum(o["value"] for o in outputs)
        fee = max(0, total_in - total_out)
        size = tx.get("size", 250)

        return {
            "txid": tx.get("hash", ""),
            "inputs": inputs,
            "outputs": outputs,
            "fee": fee,
            "fee_rate": fee / max(size, 1),
            "timestamp": int(time.time() * 1000),
            "size": size
        }

    def _parse_eth(self, data: dict) -> Optional[Dict[str, Any]]:
        if "params" not in data:
            return None
        tx_hash = data["params"].get("result", "")
        return {
            "txid": tx_hash,
            "inputs": [{"prev_txid": "", "prev_index": 0,
                        "address": "pending", "value": 0}],
            "outputs": [{"address": "pending", "value": 0, "index": 0}],
            "fee": 0, "fee_rate": 0.0,
            "timestamp": int(time.time() * 1000), "size": 0
        }

    def stop(self):
        self._running = False


# ─── Demo Simulator ─────────────────────────────────────────────────────────

# Realistic Bitcoin address prefixes
_ADDR_PREFIXES = ["1", "3", "bc1q", "bc1p"]
_MIXER_ADDRS = [f"bc1qmix{i:04d}" for i in range(50)]


def _rand_addr() -> str:
    prefix = random.choice(_ADDR_PREFIXES)
    suffix = hashlib.sha256(random.randbytes(16)).hexdigest()[:32]
    return prefix + suffix


def _rand_txid() -> str:
    return hashlib.sha256(random.randbytes(32)).hexdigest()


class DemoSimulator:
    """High-fidelity mempool transaction simulator for demo/dev mode."""

    def __init__(self, interval: float = 0.5):
        self.interval = interval
        self._running = False
        self._tx_count = 0

    async def stream(self) -> AsyncGenerator[Dict[str, Any], None]:
        self._running = True
        logger.info("Starting demo simulator")

        while self._running:
            # Mix of transaction types with realistic probabilities
            roll = random.random()
            if roll < 0.05:
                tx = self._gen_coinjoin()
            elif roll < 0.10:
                tx = self._gen_peeling()
            elif roll < 0.15:
                tx = self._gen_consolidation()
            elif roll < 0.20:
                tx = self._gen_fee_anomaly()
            else:
                tx = self._gen_normal()

            self._tx_count += 1
            yield tx
            await asyncio.sleep(self.interval * (0.5 + random.random()))

    def _gen_normal(self) -> Dict[str, Any]:
        """Standard 1-2 input, 1-2 output transaction."""
        n_in = random.choice([1, 1, 1, 2])
        n_out = random.choice([1, 2, 2])
        total_in = random.randint(10000, 50000000)  # 0.0001 – 0.5 BTC

        inputs = [{
            "prev_txid": _rand_txid(), "prev_index": 0,
            "address": _rand_addr(), "value": total_in // n_in
        } for _ in range(n_in)]

        fee = random.randint(200, 5000)
        remaining = total_in - fee
        outputs = []
        for i in range(n_out):
            val = remaining // n_out if i < n_out - 1 else remaining - sum(o["value"] for o in outputs)
            outputs.append({"address": _rand_addr(), "value": max(val, 546), "index": i})

        size = random.randint(200, 400)
        return {
            "txid": _rand_txid(), "inputs": inputs, "outputs": outputs,
            "fee": fee, "fee_rate": fee / size,
            "timestamp": int(time.time() * 1000), "size": size
        }

    def _gen_coinjoin(self) -> Dict[str, Any]:
        """CoinJoin: many inputs, many equal-value outputs."""
        n_participants = random.randint(5, 15)
        mix_amount = random.choice([100000, 500000, 1000000, 5000000])

        inputs = [{
            "prev_txid": _rand_txid(), "prev_index": 0,
            "address": _rand_addr(),
            "value": mix_amount + random.randint(1000, 10000)
        } for _ in range(n_participants)]

        outputs = [{"address": random.choice(_MIXER_ADDRS),
                     "value": mix_amount, "index": i}
                    for i in range(n_participants)]
        # Add change outputs
        for i in range(random.randint(2, 5)):
            outputs.append({"address": _rand_addr(),
                            "value": random.randint(500, 5000),
                            "index": len(outputs)})

        total_in = sum(i["value"] for i in inputs)
        total_out = sum(o["value"] for o in outputs)
        fee = max(total_in - total_out, 1000)
        size = random.randint(800, 3000)

        return {
            "txid": _rand_txid(), "inputs": inputs, "outputs": outputs,
            "fee": fee, "fee_rate": fee / size,
            "timestamp": int(time.time() * 1000), "size": size
        }

    def _gen_peeling(self) -> Dict[str, Any]:
        """Peeling chain: 1 input → 2 outputs (1 large + 1 small)."""
        total = random.randint(5000000, 100000000)
        peel = random.randint(100000, total // 10)

        return {
            "txid": _rand_txid(),
            "inputs": [{"prev_txid": _rand_txid(), "prev_index": 0,
                         "address": _rand_addr(), "value": total}],
            "outputs": [
                {"address": _rand_addr(), "value": total - peel - 500, "index": 0},
                {"address": _rand_addr(), "value": peel, "index": 1}
            ],
            "fee": 500, "fee_rate": 2.0,
            "timestamp": int(time.time() * 1000), "size": 250
        }

    def _gen_consolidation(self) -> Dict[str, Any]:
        """UTXO consolidation: many inputs → 1 output."""
        n_in = random.randint(8, 30)
        addr = _rand_addr()
        per_input = random.randint(10000, 500000)

        inputs = [{
            "prev_txid": _rand_txid(), "prev_index": 0,
            "address": addr, "value": per_input
        } for _ in range(n_in)]

        total = n_in * per_input
        fee = random.randint(2000, 10000)

        return {
            "txid": _rand_txid(), "inputs": inputs,
            "outputs": [{"address": addr, "value": total - fee, "index": 0}],
            "fee": fee, "fee_rate": fee / (n_in * 60 + 40),
            "timestamp": int(time.time() * 1000), "size": n_in * 60 + 40
        }

    def _gen_fee_anomaly(self) -> Dict[str, Any]:
        """Transaction with abnormally high fee rate."""
        tx = self._gen_normal()
        tx["fee"] = random.randint(500000, 5000000)  # Absurd fee
        tx["fee_rate"] = tx["fee"] / max(tx["size"], 1)
        return tx

    def stop(self):
        self._running = False
