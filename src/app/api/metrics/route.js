import { METRICS_CONFIG } from "open-sse/config/runtimeConfig.js";
import { renderMetrics, setGauge } from "open-sse/services/runtimeMetrics.js";
import { getConcurrencyStats } from "open-sse/services/concurrencyLimiter.js";
import { getCircuitSnapshot } from "open-sse/services/circuitBreaker.js";

// Prometheus-compatible scrape endpoint.
//
// Auth: this lives under /api/*, which `dashboardGuard.js` gates deny-by-default
// (CLI token or authenticated dashboard session). Unlike /v1/* it is NOT part of
// the public LLM API allow-list, so it never becomes an unauthenticated surface.
//
// Privacy: only aggregates are exported. Gauges below are read from live
// in-process state; the counter families are populated on the request path and
// never carry prompts, keys, request ids or user content as labels. Connection
// ids are deliberately collapsed into their provider so internal identifiers do
// not leak through the scrape.

export const dynamic = "force-dynamic";

export async function GET() {
  if (!METRICS_CONFIG.enabled) {
    return new Response(JSON.stringify({ error: { message: "Metrics disabled" } }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { active, queued, byProvider } = getConcurrencyStats();
    setGauge("miawrouter_active_requests", active, null, "In-flight upstream requests");
    setGauge("miawrouter_queue_depth", queued, null, "Requests waiting for a concurrency slot");
    for (const [provider, count] of Object.entries(byProvider)) {
      setGauge("miawrouter_provider_active_requests", count, { provider }, "In-flight upstream requests per provider");
    }

    const circuitCounts = new Map();
    for (const circuit of getCircuitSnapshot()) {
      const provider = String(circuit.key).split(":")[0] || "unknown";
      const stateKey = `${provider}\u0000${circuit.state}`;
      circuitCounts.set(stateKey, (circuitCounts.get(stateKey) || 0) + 1);
    }
    for (const [stateKey, count] of circuitCounts) {
      const [provider, state] = stateKey.split("\u0000");
      setGauge("miawrouter_circuit_state", count, { provider, state }, "Provider connections per circuit state");
    }
  } catch {
    // Observability must never be the reason a scrape fails hard.
  }

  return new Response(renderMetrics(), {
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
