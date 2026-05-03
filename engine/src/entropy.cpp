#include "spectre/entropy.hpp"
#include <numeric>
#include <algorithm>

namespace spectre {

double EntropyCalculator::compute(const std::vector<TxOutput>& outputs) {
    if (outputs.empty()) return 0.0;

    std::vector<Satoshi> values;
    values.reserve(outputs.size());
    for (const auto& out : outputs) {
        values.push_back(out.value);
    }
    return compute_from_values(values);
}

double EntropyCalculator::compute_from_values(const std::vector<Satoshi>& values) {
    if (values.empty()) return 0.0;

    // Filter out zero/negative values
    std::vector<double> positive_vals;
    positive_vals.reserve(values.size());
    for (auto v : values) {
        if (v > 0) {
            positive_vals.push_back(static_cast<double>(v));
        }
    }

    if (positive_vals.empty()) return 0.0;

    // Compute total for normalization
    double total = 0.0;
    for (double v : positive_vals) {
        total += v;
    }

    if (total <= 0.0) return 0.0;

    // Shannon entropy: H(X) = -Σ P(xi) * log2(P(xi))
    double entropy = 0.0;
    for (double v : positive_vals) {
        double p = v / total;
        if (p > 0.0) {
            entropy -= p * std::log2(p);
        }
    }

    return entropy;
}

double EntropyCalculator::max_entropy(size_t n) {
    if (n <= 1) return 0.0;
    return std::log2(static_cast<double>(n));
}

double EntropyCalculator::normalized_entropy(const std::vector<TxOutput>& outputs) {
    if (outputs.size() <= 1) return 0.0;

    double h = compute(outputs);
    double h_max = max_entropy(outputs.size());

    if (h_max <= 0.0) return 0.0;
    return h / h_max;
}

} // namespace spectre
