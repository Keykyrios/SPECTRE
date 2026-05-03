#pragma once

#include "types.hpp"
#include "graph.hpp"
#include "entropy.hpp"
#include <mutex>

namespace spectre {

/**
 * SpectreDetector — Core anomaly detection engine.
 *
 * Combines streaming statistics (EMA / Z-score), Shannon entropy analysis,
 * CoinJoin heuristics, and graph-based peeling chain detection into a
 * single analysis pipeline for real-time mempool transactions.
 */
class SpectreDetector {
public:
    /**
     * @param alpha  EMA decay factor (default 0.05, weights recent txs more)
     * @param z_threshold  Z-score threshold for fee anomaly flagging
     * @param entropy_threshold  Shannon entropy threshold for mixing detection
     * @param coinjoin_tolerance  Output-equality tolerance for CoinJoin detection
     */
    explicit SpectreDetector(
        double alpha = 0.05,
        double z_threshold = 3.0,
        double entropy_threshold = 3.5,
        double coinjoin_tolerance = 0.01
    );

    // Analyze a single mempool transaction — returns full AnalysisResult
    AnalysisResult analyze(const MempoolTx& tx);

    // Get current streaming statistics
    StreamingStats get_stats() const;

    // Get reference to the internal UTXO graph
    const UTXOGraph& graph() const { return graph_; }

    // Reset all state
    void reset();

    // Get total transactions processed
    uint64_t tx_count() const { return stats_.count; }

private:
    // ── Streaming fee statistics ─────────────────────────────────
    StreamingStats stats_;
    double z_threshold_;

    // ── Entropy analysis ─────────────────────────────────────────
    double entropy_threshold_;

    // ── CoinJoin detection ───────────────────────────────────────
    double coinjoin_tolerance_;

    // ── UTXO graph ───────────────────────────────────────────────
    UTXOGraph graph_;

    // ── Thread safety ────────────────────────────────────────────
    mutable std::mutex mutex_;

    // Update EMA streaming stats with new fee rate
    void update_stats_(double fee_rate);

    // Compute Z-score for current fee rate
    double compute_zscore_(double fee_rate) const;

    // Detect CoinJoin pattern in outputs
    double detect_coinjoin_(const std::vector<TxOutput>& outputs) const;
};

} // namespace spectre
