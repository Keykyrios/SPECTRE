#pragma once

#include <cstdint>
#include <string>
#include <vector>
#include <unordered_map>
#include <chrono>

namespace spectre {

// ─── Core type aliases ─────────────────────────────────────────────────────────

using TxId    = std::string;
using Address = std::string;
using Satoshi = int64_t;

// ─── Transaction output ────────────────────────────────────────────────────────

struct TxOutput {
    Address address;
    Satoshi value;
    uint32_t index;
};

// ─── Transaction input ─────────────────────────────────────────────────────────

struct TxInput {
    TxId     prev_txid;
    uint32_t prev_index;
    Address  address;
    Satoshi  value;
};

// ─── Raw mempool transaction ───────────────────────────────────────────────────

struct MempoolTx {
    TxId                 txid;
    std::vector<TxInput> inputs;
    std::vector<TxOutput> outputs;
    Satoshi              fee;
    double               fee_rate;     // sat/vByte
    uint64_t             timestamp;    // unix epoch ms
    uint32_t             size;         // virtual size in vBytes
};

// ─── Threat classification ─────────────────────────────────────────────────────

enum class ThreatType : uint8_t {
    CLEAN            = 0,
    PEELING_CHAIN    = 1,
    COINJOIN         = 2,
    CONSOLIDATION    = 3,
    FEE_ANOMALY      = 4,
    HIGH_ENTROPY     = 5,
    MULTI_THREAT     = 6
};

inline const char* threat_name(ThreatType t) {
    switch (t) {
        case ThreatType::CLEAN:         return "CLEAN";
        case ThreatType::PEELING_CHAIN: return "PEELING_CHAIN";
        case ThreatType::COINJOIN:      return "COINJOIN";
        case ThreatType::CONSOLIDATION: return "CONSOLIDATION";
        case ThreatType::FEE_ANOMALY:   return "FEE_ANOMALY";
        case ThreatType::HIGH_ENTROPY:  return "HIGH_ENTROPY";
        case ThreatType::MULTI_THREAT:  return "MULTI_THREAT";
        default:                        return "UNKNOWN";
    }
}

// ─── Analysis result ───────────────────────────────────────────────────────────

struct AnalysisResult {
    TxId       txid;
    ThreatType threat;
    double     anomaly_score;       // Z-score for fee anomaly
    double     entropy;             // Shannon entropy of outputs
    double     coinjoin_confidence; // 0.0–1.0 CoinJoin likelihood
    bool       is_peeling;          // Peeling chain detected
    bool       is_consolidation;    // UTXO consolidation detected
    uint64_t   analysis_time_us;    // Microsecond processing latency

    // Linked addresses for graph rendering
    std::vector<Address> source_addresses;
    std::vector<Address> dest_addresses;
    std::vector<Satoshi> output_values;
};

// ─── Graph edge for UTXO DAG ──────────────────────────────────────────────────

struct GraphEdge {
    Address from;
    Address to;
    Satoshi value;
    TxId    txid;
};

// ─── Streaming statistics state ────────────────────────────────────────────────

struct StreamingStats {
    double mean     = 0.0;
    double variance = 0.0;
    double alpha    = 0.05;   // EMA decay factor
    uint64_t count  = 0;
};

} // namespace spectre
