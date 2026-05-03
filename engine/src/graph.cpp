#include "spectre/graph.hpp"
#include <algorithm>
#include <queue>
#include <cmath>

namespace spectre {

void UTXOGraph::insert_transaction(const MempoolTx& tx) {
    std::lock_guard<std::mutex> lock(mutex_);

    for (const auto& input : tx.inputs) {
        nodes_.insert(input.address);
        for (const auto& output : tx.outputs) {
            nodes_.insert(output.address);
            GraphEdge edge{input.address, output.address, output.value, tx.txid};
            adj_out_[input.address].push_back(edge);
            adj_in_[output.address].push_back(edge);
        }
    }
}

bool UTXOGraph::detect_peeling_chain(const MempoolTx& tx, int min_depth) const {
    // Peeling chain pattern:
    //   - Exactly 1 input
    //   - Exactly 2 outputs
    //   - One output significantly larger than the other
    //   - The pattern repeats for min_depth hops

    if (tx.inputs.size() != 1 || tx.outputs.size() != 2) {
        return false;
    }

    // Check value asymmetry: one output should be >> the other
    Satoshi v0 = tx.outputs[0].value;
    Satoshi v1 = tx.outputs[1].value;
    double ratio = static_cast<double>(std::min(v0, v1)) /
                   static_cast<double>(std::max(v0, v1));

    // If the smaller output is > 30% of the larger, it's probably not peeling
    if (ratio > 0.30) {
        return false;
    }

    // The "peel" address is the one receiving the larger output
    // Check if it has further peeling-pattern outgoing edges
    std::lock_guard<std::mutex> lock(mutex_);
    Address peel_addr = (v0 > v1) ? tx.outputs[0].address : tx.outputs[1].address;

    std::unordered_set<Address> visited;
    visited.insert(tx.inputs[0].address);
    return walk_peeling_(peel_addr, 1, min_depth, visited);
}

bool UTXOGraph::walk_peeling_(const Address& addr, int depth, int min_depth,
                               std::unordered_set<Address>& visited) const {
    if (depth >= min_depth) {
        return true;  // Found a chain of sufficient depth
    }

    if (visited.count(addr)) {
        return false;  // Cycle detected
    }
    visited.insert(addr);

    auto it = adj_out_.find(addr);
    if (it == adj_out_.end()) {
        return false;
    }

    // Group outgoing edges by txid to find subsequent peeling transactions
    std::unordered_map<TxId, std::vector<const GraphEdge*>> by_tx;
    for (const auto& edge : it->second) {
        by_tx[edge.txid].push_back(&edge);
    }

    for (const auto& [txid, edges] : by_tx) {
        if (edges.size() != 2) continue;

        Satoshi va = edges[0]->value;
        Satoshi vb = edges[1]->value;
        double r = static_cast<double>(std::min(va, vb)) /
                   static_cast<double>(std::max(va, vb));

        if (r > 0.30) continue;

        // Follow the larger output
        const Address& next = (va > vb) ? edges[0]->to : edges[1]->to;
        if (walk_peeling_(next, depth + 1, min_depth, visited)) {
            return true;
        }
    }

    return false;
}

bool UTXOGraph::detect_consolidation(const MempoolTx& tx, int min_inputs) const {
    // Consolidation: many inputs from related addresses → few outputs
    if (static_cast<int>(tx.inputs.size()) < min_inputs) {
        return false;
    }

    if (tx.outputs.size() > 2) {
        return false;  // Consolidation typically goes to 1–2 outputs
    }

    // Check if inputs share common address prefixes (cluster heuristic)
    // Simple heuristic: if > 60% of inputs share the same address, it's consolidation
    std::unordered_map<Address, int> addr_count;
    for (const auto& input : tx.inputs) {
        addr_count[input.address]++;
    }

    int max_count = 0;
    for (const auto& [addr, count] : addr_count) {
        max_count = std::max(max_count, count);
    }

    double concentration = static_cast<double>(max_count) / tx.inputs.size();
    return concentration > 0.4;  // 40% threshold
}

std::vector<GraphEdge> UTXOGraph::get_edges() const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<GraphEdge> result;
    for (const auto& [addr, edges] : adj_out_) {
        result.insert(result.end(), edges.begin(), edges.end());
    }
    return result;
}

std::vector<GraphEdge> UTXOGraph::get_neighbors(const Address& addr) const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<GraphEdge> result;

    auto it_out = adj_out_.find(addr);
    if (it_out != adj_out_.end()) {
        result.insert(result.end(), it_out->second.begin(), it_out->second.end());
    }

    auto it_in = adj_in_.find(addr);
    if (it_in != adj_in_.end()) {
        result.insert(result.end(), it_in->second.begin(), it_in->second.end());
    }

    return result;
}

std::vector<GraphEdge> UTXOGraph::trace_forward(const Address& addr, int max_depth) const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<GraphEdge> result;
    std::unordered_set<Address> visited;
    std::queue<std::pair<Address, int>> queue;
    queue.push({addr, 0});

    while (!queue.empty()) {
        auto [current, depth] = queue.front();
        queue.pop();

        if (depth >= max_depth || visited.count(current)) continue;
        visited.insert(current);

        auto it = adj_out_.find(current);
        if (it == adj_out_.end()) continue;

        for (const auto& edge : it->second) {
            result.push_back(edge);
            queue.push({edge.to, depth + 1});
        }
    }

    return result;
}

std::vector<GraphEdge> UTXOGraph::trace_backward(const Address& addr, int max_depth) const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<GraphEdge> result;
    std::unordered_set<Address> visited;
    std::queue<std::pair<Address, int>> queue;
    queue.push({addr, 0});

    while (!queue.empty()) {
        auto [current, depth] = queue.front();
        queue.pop();

        if (depth >= max_depth || visited.count(current)) continue;
        visited.insert(current);

        auto it = adj_in_.find(current);
        if (it == adj_in_.end()) continue;

        for (const auto& edge : it->second) {
            result.push_back(edge);
            queue.push({edge.from, depth + 1});
        }
    }

    return result;
}

size_t UTXOGraph::node_count() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return nodes_.size();
}

size_t UTXOGraph::edge_count() const {
    std::lock_guard<std::mutex> lock(mutex_);
    size_t count = 0;
    for (const auto& [addr, edges] : adj_out_) {
        count += edges.size();
    }
    return count;
}

void UTXOGraph::clear() {
    std::lock_guard<std::mutex> lock(mutex_);
    adj_out_.clear();
    adj_in_.clear();
    nodes_.clear();
}

} // namespace spectre
