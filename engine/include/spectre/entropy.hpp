#pragma once

#include "types.hpp"
#include <vector>
#include <cmath>

namespace spectre {

/**
 * Shannon Entropy calculator for transaction output distributions.
 *
 * Mixing services (CoinJoin, tumbling) produce outputs with uniformly
 * distributed values, resulting in high entropy. Normal transactions
 * typically show skewed distributions (one large, one small change output).
 *
 * H(X) = -Σ P(xi) * log2(P(xi))
 */
class EntropyCalculator {
public:
    /**
     * Compute Shannon entropy of transaction output values.
     * Values are treated as a probability distribution (normalized by total).
     *
     * @param outputs  Transaction output list
     * @return Shannon entropy in bits
     */
    static double compute(const std::vector<TxOutput>& outputs);

    /**
     * Compute entropy from raw value vector.
     *
     * @param values  Vector of output amounts (satoshis)
     * @return Shannon entropy in bits
     */
    static double compute_from_values(const std::vector<Satoshi>& values);

    /**
     * Maximum possible entropy for n outputs (all equal).
     * H_max = log2(n)
     */
    static double max_entropy(size_t n);

    /**
     * Normalized entropy: H(X) / H_max ∈ [0, 1].
     * Values near 1.0 indicate uniform distribution (likely mixing).
     */
    static double normalized_entropy(const std::vector<TxOutput>& outputs);
};

} // namespace spectre
