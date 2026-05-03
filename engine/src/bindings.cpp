#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <pybind11/chrono.h>

#include "spectre/types.hpp"
#include "spectre/detector.hpp"
#include "spectre/entropy.hpp"
#include "spectre/graph.hpp"

namespace py = pybind11;

PYBIND11_MODULE(spectre_engine, m) {
    m.doc() = "Spectre C++ Analysis Engine — Real-Time UTXO Heuristics";

    // ─── Enums ─────────────────────────────────────────────────────────────────

    py::enum_<spectre::ThreatType>(m, "ThreatType")
        .value("CLEAN",         spectre::ThreatType::CLEAN)
        .value("PEELING_CHAIN", spectre::ThreatType::PEELING_CHAIN)
        .value("COINJOIN",      spectre::ThreatType::COINJOIN)
        .value("CONSOLIDATION", spectre::ThreatType::CONSOLIDATION)
        .value("FEE_ANOMALY",   spectre::ThreatType::FEE_ANOMALY)
        .value("HIGH_ENTROPY",  spectre::ThreatType::HIGH_ENTROPY)
        .value("MULTI_THREAT",  spectre::ThreatType::MULTI_THREAT)
        .export_values();

    // ─── Data structures ───────────────────────────────────────────────────────

    py::class_<spectre::TxOutput>(m, "TxOutput")
        .def(py::init<>())
        .def_readwrite("address", &spectre::TxOutput::address)
        .def_readwrite("value",   &spectre::TxOutput::value)
        .def_readwrite("index",   &spectre::TxOutput::index);

    py::class_<spectre::TxInput>(m, "TxInput")
        .def(py::init<>())
        .def_readwrite("prev_txid",  &spectre::TxInput::prev_txid)
        .def_readwrite("prev_index", &spectre::TxInput::prev_index)
        .def_readwrite("address",    &spectre::TxInput::address)
        .def_readwrite("value",      &spectre::TxInput::value);

    py::class_<spectre::MempoolTx>(m, "MempoolTx")
        .def(py::init<>())
        .def_readwrite("txid",      &spectre::MempoolTx::txid)
        .def_readwrite("inputs",    &spectre::MempoolTx::inputs)
        .def_readwrite("outputs",   &spectre::MempoolTx::outputs)
        .def_readwrite("fee",       &spectre::MempoolTx::fee)
        .def_readwrite("fee_rate",  &spectre::MempoolTx::fee_rate)
        .def_readwrite("timestamp", &spectre::MempoolTx::timestamp)
        .def_readwrite("size",      &spectre::MempoolTx::size);

    py::class_<spectre::AnalysisResult>(m, "AnalysisResult")
        .def(py::init<>())
        .def_readwrite("txid",               &spectre::AnalysisResult::txid)
        .def_readwrite("threat",             &spectre::AnalysisResult::threat)
        .def_readwrite("anomaly_score",      &spectre::AnalysisResult::anomaly_score)
        .def_readwrite("entropy",            &spectre::AnalysisResult::entropy)
        .def_readwrite("coinjoin_confidence",&spectre::AnalysisResult::coinjoin_confidence)
        .def_readwrite("is_peeling",         &spectre::AnalysisResult::is_peeling)
        .def_readwrite("is_consolidation",   &spectre::AnalysisResult::is_consolidation)
        .def_readwrite("analysis_time_us",   &spectre::AnalysisResult::analysis_time_us)
        .def_readwrite("source_addresses",   &spectre::AnalysisResult::source_addresses)
        .def_readwrite("dest_addresses",     &spectre::AnalysisResult::dest_addresses)
        .def_readwrite("output_values",      &spectre::AnalysisResult::output_values);

    py::class_<spectre::GraphEdge>(m, "GraphEdge")
        .def(py::init<>())
        .def_readwrite("from_addr", &spectre::GraphEdge::from)
        .def_readwrite("to_addr",   &spectre::GraphEdge::to)
        .def_readwrite("value",     &spectre::GraphEdge::value)
        .def_readwrite("txid",      &spectre::GraphEdge::txid);

    py::class_<spectre::StreamingStats>(m, "StreamingStats")
        .def(py::init<>())
        .def_readwrite("mean",     &spectre::StreamingStats::mean)
        .def_readwrite("variance", &spectre::StreamingStats::variance)
        .def_readwrite("alpha",    &spectre::StreamingStats::alpha)
        .def_readwrite("count",    &spectre::StreamingStats::count);

    // ─── Entropy Calculator ────────────────────────────────────────────────────

    py::class_<spectre::EntropyCalculator>(m, "EntropyCalculator")
        .def_static("compute",             &spectre::EntropyCalculator::compute,
                     py::arg("outputs"))
        .def_static("compute_from_values", &spectre::EntropyCalculator::compute_from_values,
                     py::arg("values"))
        .def_static("max_entropy",         &spectre::EntropyCalculator::max_entropy,
                     py::arg("n"))
        .def_static("normalized_entropy",  &spectre::EntropyCalculator::normalized_entropy,
                     py::arg("outputs"));

    // ─── UTXO Graph ────────────────────────────────────────────────────────────

    py::class_<spectre::UTXOGraph>(m, "UTXOGraph")
        .def(py::init<>())
        .def("insert_transaction",   &spectre::UTXOGraph::insert_transaction)
        .def("detect_peeling_chain", &spectre::UTXOGraph::detect_peeling_chain,
             py::arg("tx"), py::arg("min_depth") = 3)
        .def("detect_consolidation", &spectre::UTXOGraph::detect_consolidation,
             py::arg("tx"), py::arg("min_inputs") = 5)
        .def("get_edges",           &spectre::UTXOGraph::get_edges)
        .def("get_neighbors",       &spectre::UTXOGraph::get_neighbors)
        .def("trace_forward",       &spectre::UTXOGraph::trace_forward,
             py::arg("addr"), py::arg("max_depth") = 10)
        .def("trace_backward",      &spectre::UTXOGraph::trace_backward,
             py::arg("addr"), py::arg("max_depth") = 10)
        .def("node_count",          &spectre::UTXOGraph::node_count)
        .def("edge_count",          &spectre::UTXOGraph::edge_count)
        .def("clear",               &spectre::UTXOGraph::clear);

    // ─── Spectre Detector ──────────────────────────────────────────────────────

    py::class_<spectre::SpectreDetector>(m, "SpectreDetector")
        .def(py::init<double, double, double, double>(),
             py::arg("alpha") = 0.05,
             py::arg("z_threshold") = 3.0,
             py::arg("entropy_threshold") = 3.5,
             py::arg("coinjoin_tolerance") = 0.01)
        .def("analyze",    &spectre::SpectreDetector::analyze,
             py::arg("tx"),
             "Analyze a mempool transaction and return threat classification")
        .def("get_stats",  &spectre::SpectreDetector::get_stats)
        .def("tx_count",   &spectre::SpectreDetector::tx_count)
        .def("reset",      &spectre::SpectreDetector::reset);

    // ─── Utility functions ─────────────────────────────────────────────────────

    m.def("threat_name", &spectre::threat_name,
          py::arg("threat_type"),
          "Get human-readable name for a ThreatType enum value");
}
