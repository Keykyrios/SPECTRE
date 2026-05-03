"""
Spectre Processor — Bridge between raw mempool data and the C++ engine.
Converts JSON transactions to C++ types, runs analysis, emits results.
"""

import time
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("spectre.processor")

# Try importing the compiled C++ engine; fall back to pure-Python shim
try:
    import spectre_engine as engine
    HAS_ENGINE = True
    logger.info("C++ spectre_engine loaded successfully")
except ImportError:
    HAS_ENGINE = False
    logger.warning("C++ engine not compiled — using pure-Python analysis shim")

import math, random, hashlib


# ─── Pure-Python fallback shim ──────────────────────────────────────────────

class _ShimStats:
    def __init__(self, alpha=0.05):
        self.mean = 0.0
        self.variance = 0.0
        self.alpha = alpha
        self.count = 0

    def update(self, x: float):
        if self.count == 0:
            self.mean = x
            self.variance = 0.0
        else:
            self.mean = self.alpha * x + (1 - self.alpha) * self.mean
            dev = x - self.mean
            self.variance = self.alpha * (dev * dev) + (1 - self.alpha) * self.variance
        self.count += 1

    def zscore(self, x: float) -> float:
        if self.count < 10 or self.variance <= 0:
            return 0.0
        sd = math.sqrt(self.variance)
        return (x - self.mean) / sd if sd > 1e-10 else 0.0


def _shannon_entropy(values: list) -> float:
    positives = [v for v in values if v > 0]
    if not positives:
        return 0.0
    total = sum(positives)
    if total <= 0:
        return 0.0
    entropy = 0.0
    for v in positives:
        p = v / total
        if p > 0:
            entropy -= p * math.log2(p)
    return entropy


def _detect_coinjoin(outputs: list) -> float:
    if len(outputs) < 3:
        return 0.0
    counts: Dict[int, int] = {}
    for o in outputs:
        rounded = (o["value"] // 1000) * 1000
        counts[rounded] = counts.get(rounded, 0) + 1
    max_group = max(counts.values())
    conf = max_group / len(outputs)
    return conf if max_group >= 3 and conf > 0.5 else 0.0


class _ShimDetector:
    """Pure-Python fallback matching the C++ engine interface."""

    def __init__(self, alpha=0.05, z_thresh=3.0, ent_thresh=3.5):
        self._stats = _ShimStats(alpha)
        self._z_thresh = z_thresh
        self._ent_thresh = ent_thresh
        self._count = 0

    def analyze(self, tx: Dict[str, Any]) -> Dict[str, Any]:
        start = time.perf_counter_ns()
        self._stats.update(tx["fee_rate"])
        z = self._stats.zscore(tx["fee_rate"])

        out_values = [o["value"] for o in tx["outputs"]]
        entropy = _shannon_entropy(out_values)
        cj_conf = _detect_coinjoin(tx["outputs"])

        # Peeling heuristic
        is_peeling = (
            len(tx["inputs"]) == 1 and len(tx["outputs"]) == 2
            and min(out_values) / max(max(out_values), 1) < 0.3
        )

        # Consolidation heuristic
        is_consolidation = (
            len(tx["inputs"]) >= 5 and len(tx["outputs"]) <= 2
        )

        # Threat classification
        threats = []
        if is_peeling:
            threats.append("PEELING_CHAIN")
        if cj_conf > 0.6:
            threats.append("COINJOIN")
        if is_consolidation:
            threats.append("CONSOLIDATION")
        if abs(z) > self._z_thresh:
            threats.append("FEE_ANOMALY")
        if entropy > self._ent_thresh:
            threats.append("HIGH_ENTROPY")

        if len(threats) > 1:
            threat = "MULTI_THREAT"
        elif len(threats) == 1:
            threat = threats[0]
        else:
            threat = "CLEAN"

        elapsed_us = (time.perf_counter_ns() - start) // 1000
        self._count += 1

        return {
            "txid": tx["txid"],
            "threat": threat,
            "anomaly_score": round(z, 4),
            "entropy": round(entropy, 4),
            "coinjoin_confidence": round(cj_conf, 4),
            "is_peeling": is_peeling,
            "is_consolidation": is_consolidation,
            "analysis_time_us": elapsed_us,
            "source_addresses": [i["address"] for i in tx["inputs"]],
            "dest_addresses": [o["address"] for o in tx["outputs"]],
            "output_values": out_values,
        }

    @property
    def tx_count(self):
        return self._count

    @property
    def stats(self):
        return {
            "mean": self._stats.mean,
            "variance": self._stats.variance,
            "count": self._stats.count
        }


# ─── Unified Processor ─────────────────────────────────────────────────────

class SpectreProcessor:
    """
    Wraps the C++ engine (or Python fallback) and provides a clean
    analyze(tx_dict) → result_dict interface.
    """

    def __init__(self, alpha=0.05, z_threshold=3.0,
                 entropy_threshold=3.5, coinjoin_tolerance=0.01):
        if HAS_ENGINE:
            self._detector = engine.SpectreDetector(
                alpha, z_threshold, entropy_threshold, coinjoin_tolerance
            )
            self._native = True
        else:
            self._detector = _ShimDetector(alpha, z_threshold, entropy_threshold)
            self._native = False

        logger.info(f"Processor initialized (native={'yes' if self._native else 'no'})")

    def analyze(self, tx_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze a transaction dict and return result dict."""
        if self._native:
            return self._analyze_native(tx_dict)
        return self._detector.analyze(tx_dict)

    def _analyze_native(self, tx_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Convert dict → C++ types, run engine, convert back."""
        tx = engine.MempoolTx()
        tx.txid = tx_dict["txid"]
        tx.fee = tx_dict["fee"]
        tx.fee_rate = tx_dict["fee_rate"]
        tx.timestamp = tx_dict["timestamp"]
        tx.size = tx_dict["size"]

        tx.inputs = []
        for i in tx_dict["inputs"]:
            inp = engine.TxInput()
            inp.prev_txid = str(i["prev_txid"])
            inp.prev_index = i["prev_index"]
            inp.address = i["address"]
            inp.value = i["value"]
            tx.inputs.append(inp)

        tx.outputs = []
        for o in tx_dict["outputs"]:
            out = engine.TxOutput()
            out.address = o["address"]
            out.value = o["value"]
            out.index = o["index"]
            tx.outputs.append(out)

        result = self._detector.analyze(tx)

        return {
            "txid": result.txid,
            "threat": engine.threat_name(result.threat),
            "anomaly_score": round(result.anomaly_score, 4),
            "entropy": round(result.entropy, 4),
            "coinjoin_confidence": round(result.coinjoin_confidence, 4),
            "is_peeling": result.is_peeling,
            "is_consolidation": result.is_consolidation,
            "analysis_time_us": result.analysis_time_us,
            "source_addresses": list(result.source_addresses),
            "dest_addresses": list(result.dest_addresses),
            "output_values": list(result.output_values),
        }

    @property
    def tx_count(self):
        if self._native:
            return self._detector.tx_count()
        return self._detector.tx_count

    @property
    def engine_type(self) -> str:
        return "C++ (pybind11)" if self._native else "Python (shim)"
