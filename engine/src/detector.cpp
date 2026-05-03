#include "spectre/detector.hpp"
#include <chrono>
#include <cmath>
#include <algorithm>
#include <unordered_map>

namespace spectre {

SpectreDetector::SpectreDetector(
    double alpha,
    double z_threshold,
    double entropy_threshold,
    double coinjoin_tolerance
)
    : z_threshold_(z_threshold)
    , entropy_threshold_(entropy_threshold)
    , coinjoin_tolerance_(coinjoin_tolerance)
{
    stats_.alpha = alpha;
    stats_.mean = 0.0;
    stats_.variance = 0.0;
    stats_.count = 0;
}

void SpectreDetector::update_stats_(double fee_rate) {
    if (stats_.count == 0) {
        stats_.mean = fee_rate;
        stats_.variance = 0.0;
    } else {
        // Exponential Moving Average update:
        //   μ_t = α * x_t + (1 - α) * μ_{t-1}
        //   σ²_t = α * (x_t - μ_t)² + (1 - α) * σ²_{t-1}
        double alpha = stats_.alpha;
        double prev_mean = stats_.mean;

        stats_.mean = alpha * fee_rate + (1.0 - alpha) * prev_mean;
        double deviation = fee_rate - stats_.mean;
        stats_.variance = alpha * (deviation * deviation) + (1.0 - alpha) * stats_.variance;
    }
    stats_.count++;
}

double SpectreDetector::compute_zscore_(double fee_rate) const {
    if (stats_.count < 10 || stats_.variance <= 0.0) {
        return 0.0;  // Not enough data for meaningful Z-score
    }

    double stddev = std::sqrt(stats_.variance);
    if (stddev < 1e-10) return 0.0;

    // Z = (x_t - μ_t) / σ_t
    return (fee_rate - stats_.mean) / stddev;
}

double SpectreDetector::detect_coinjoin_(const std::vector<TxOutput>& outputs) const {
    if (outputs.size() < 3) return 0.0;

    // CoinJoin heuristic: look for groups of outputs with equal values
    // Mixing services create many outputs of identical amounts
    std::unordered_map<Satoshi, int> value_counts;
    for (const auto& out : outputs) {
        // Round to nearest 1000 satoshis for tolerance
        Satoshi rounded = (out.value / 1000) * 1000;
        value_counts[rounded]++;
    }

    // Find the largest group of equal-value outputs
    int max_group = 0;
    for (const auto& [val, count] : value_counts) {
        max_group = std::max(max_group, count);
    }

    // Confidence = fraction of outputs in the largest equal-value group
    double confidence = static_cast<double>(max_group) / outputs.size();

    // Need at least 3 equal outputs and > 50% of total
    if (max_group >= 3 && confidence > 0.5) {
        return confidence;
    }

    // Secondary check: output value variance relative to mean
    double total = 0.0;
    for (const auto& out : outputs) {
        total += static_cast<double>(out.value);
    }
    double mean_val = total / outputs.size();

    double var = 0.0;
    for (const auto& out : outputs) {
        double diff = static_cast<double>(out.value) - mean_val;
        var += diff * diff;
    }
    var /= outputs.size();

    // Coefficient of variation — low CV = uniform distribution = likely mixing
    double cv = std::sqrt(var) / (mean_val + 1e-10);
    if (cv < coinjoin_tolerance_ && outputs.size() >= 5) {
        return 1.0 - cv;  // High confidence when CV is near zero
    }

    return 0.0;
}

AnalysisResult SpectreDetector::analyze(const MempoolTx& tx) {
    auto start = std::chrono::high_resolution_clock::now();

    std::lock_guard<std::mutex> lock(mutex_);

    AnalysisResult result;
    result.txid = tx.txid;
    result.is_peeling = false;
    result.is_consolidation = false;
    result.anomaly_score = 0.0;
    result.entropy = 0.0;
    result.coinjoin_confidence = 0.0;

    // Collect addresses for graph rendering
    for (const auto& input : tx.inputs) {
        result.source_addresses.push_back(input.address);
    }
    for (const auto& output : tx.outputs) {
        result.dest_addresses.push_back(output.address);
        result.output_values.push_back(output.value);
    }

    // ── 1. Update streaming statistics and compute Z-score ──────────────
    update_stats_(tx.fee_rate);
    result.anomaly_score = compute_zscore_(tx.fee_rate);

    // ── 2. Compute Shannon entropy of outputs ──────────────────────────
    result.entropy = EntropyCalculator::compute(tx.outputs);

    // ── 3. Detect CoinJoin pattern ─────────────────────────────────────
    result.coinjoin_confidence = detect_coinjoin_(tx.outputs);

    // ── 4. Insert into graph and detect structural patterns ────────────
    graph_.insert_transaction(tx);
    result.is_peeling = graph_.detect_peeling_chain(tx);
    result.is_consolidation = graph_.detect_consolidation(tx);

    // ── 5. Classify threat ─────────────────────────────────────────────
    int threat_count = 0;
    ThreatType primary = ThreatType::CLEAN;

    if (result.is_peeling) {
        primary = ThreatType::PEELING_CHAIN;
        threat_count++;
    }
    if (result.coinjoin_confidence > 0.6) {
        primary = ThreatType::COINJOIN;
        threat_count++;
    }
    if (result.is_consolidation) {
        primary = ThreatType::CONSOLIDATION;
        threat_count++;
    }
    if (std::abs(result.anomaly_score) > z_threshold_) {
        primary = ThreatType::FEE_ANOMALY;
        threat_count++;
    }
    if (result.entropy > entropy_threshold_) {
        primary = ThreatType::HIGH_ENTROPY;
        threat_count++;
    }

    if (threat_count > 1) {
        result.threat = ThreatType::MULTI_THREAT;
    } else {
        result.threat = primary;
    }

    // ── 6. Measure analysis latency ────────────────────────────────────
    auto end = std::chrono::high_resolution_clock::now();
    result.analysis_time_us = std::chrono::duration_cast<std::chrono::microseconds>(
        end - start
    ).count();

    return result;
}

StreamingStats SpectreDetector::get_stats() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return stats_;
}

void SpectreDetector::reset() {
    std::lock_guard<std::mutex> lock(mutex_);
    stats_ = StreamingStats{};
    graph_.clear();
}

} // namespace spectre
