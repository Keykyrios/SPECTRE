#pragma once

#include "types.hpp"
#include <unordered_map>
#include <unordered_set>
#include <vector>
#include <mutex>

namespace spectre {

/**
 * UTXOGraph — In-memory directed graph of UTXO flows.
 *
 * Represents wallet addresses as nodes and transaction flows as directed edges.
 * Supports fast traversal for peeling chain and consolidation detection.
 * Thread-safe for concurrent mempool ingestion.
 */
class UTXOGraph {
public:
    UTXOGraph() = default;

    // Insert a transaction into the graph
    void insert_transaction(const MempoolTx& tx);

    // Detect peeling chains originating from a transaction
    // A peeling chain: 1 input → 2 outputs, one large (peel) + one small (change)
    // Repeats across multiple hops
    bool detect_peeling_chain(const MempoolTx& tx, int min_depth = 3) const;

    // Detect UTXO consolidation: many inputs → few outputs from same cluster
    bool detect_consolidation(const MempoolTx& tx, int min_inputs = 5) const;

    // Get the full adjacency list (for serialization to frontend)
    std::vector<GraphEdge> get_edges() const;

    // Get all neighbors of an address
    std::vector<GraphEdge> get_neighbors(const Address& addr) const;

    // Traverse forward from an address up to max_depth
    std::vector<GraphEdge> trace_forward(const Address& addr, int max_depth = 10) const;

    // Traverse backward from an address up to max_depth
    std::vector<GraphEdge> trace_backward(const Address& addr, int max_depth = 10) const;

    // Node and edge counts
    size_t node_count() const;
    size_t edge_count() const;

    // Clear the graph
    void clear();

private:
    // Adjacency lists: address → outgoing edges
    std::unordered_map<Address, std::vector<GraphEdge>> adj_out_;
    // Reverse adjacency: address → incoming edges
    std::unordered_map<Address, std::vector<GraphEdge>> adj_in_;
    // All known nodes
    std::unordered_set<Address> nodes_;

    mutable std::mutex mutex_;

    // Internal recursive peeling chain walk
    bool walk_peeling_(const Address& addr, int depth, int min_depth,
                       std::unordered_set<Address>& visited) const;
};

} // namespace spectre
