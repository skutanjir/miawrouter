import { describe, it, expect, beforeEach } from "vitest";
import {
  increment,
  setGauge,
  observeHistogram,
  renderMetrics,
  _resetRuntimeMetrics,
} from "open-sse/services/runtimeMetrics.js";

beforeEach(() => {
  _resetRuntimeMetrics();
});

describe("runtime metrics registry", () => {
  it("renders counters with HELP/TYPE and labels", () => {
    increment("miawrouter_requests_total", { provider: "openai" }, "Total requests");
    increment("miawrouter_requests_total", { provider: "openai" });
    increment("miawrouter_requests_total", { provider: "groq" });

    const out = renderMetrics();
    expect(out).toContain("# TYPE miawrouter_requests_total counter");
    expect(out).toContain('miawrouter_requests_total{provider="openai"} 2');
    expect(out).toContain('miawrouter_requests_total{provider="groq"} 1');
  });

  it("sorts labels deterministically so the same series is one entry", () => {
    increment("m", { b: "2", a: "1" });
    increment("m", { a: "1", b: "2" });
    const out = renderMetrics();
    expect(out).toContain('m{a="1",b="2"} 2');
    expect(out.match(/^m\{/gm)?.length).toBe(1);
  });

  it("sets a gauge to an absolute value", () => {
    setGauge("miawrouter_queue_depth", 7, null, "Queued");
    setGauge("miawrouter_queue_depth", 3, null, "Queued");
    expect(renderMetrics()).toContain("miawrouter_queue_depth 3");
  });

  it("tracks gauges per label set", () => {
    setGauge("miawrouter_provider_active_requests", 2, { provider: "a" });
    setGauge("miawrouter_provider_active_requests", 5, { provider: "b" });
    const out = renderMetrics();
    expect(out).toContain('miawrouter_provider_active_requests{provider="a"} 2');
    expect(out).toContain('miawrouter_provider_active_requests{provider="b"} 5');
  });

  it("renders histograms with cumulative buckets, sum and count", () => {
    observeHistogram("miawrouter_request_duration_seconds", 0.3, { provider: "openai" });
    observeHistogram("miawrouter_request_duration_seconds", 3, { provider: "openai" });

    const out = renderMetrics();
    expect(out).toContain("# TYPE miawrouter_request_duration_seconds histogram");
    // 0.3 falls in le=0.5 and up; 3 falls in le=5 and up.
    expect(out).toContain('miawrouter_request_duration_seconds_bucket{provider="openai",le="0.1"} 0');
    expect(out).toContain('miawrouter_request_duration_seconds_bucket{provider="openai",le="0.5"} 1');
    expect(out).toContain('miawrouter_request_duration_seconds_bucket{provider="openai",le="5"} 2');
    expect(out).toContain('miawrouter_request_duration_seconds_bucket{provider="openai",le="+Inf"} 2');
    expect(out).toContain('miawrouter_request_duration_seconds_count{provider="openai"} 2');
    expect(out).toContain('miawrouter_request_duration_seconds_sum{provider="openai"} 3.3');
  });

  it("ignores non-finite and negative observations instead of corrupting the histogram", () => {
    observeHistogram("h", NaN);
    observeHistogram("h", -1);
    observeHistogram("h", Infinity);
    expect(renderMetrics()).not.toContain("h_count");
  });

  it("escapes label values that would break the exposition format", () => {
    // A model string is caller-controlled; it must not be able to inject lines.
    increment("miawrouter_requests_total", { model: 'evil"\nmalicious_metric 1' });
    const out = renderMetrics();
    const metricLines = out.split("\n").filter((l) => l.startsWith("miawrouter_requests_total{"));
    expect(metricLines.length).toBe(1);
    expect(out).not.toContain("malicious_metric 1\n");
  });

  it("renders an empty exposition when nothing was recorded", () => {
    expect(renderMetrics()).toBe("\n");
  });
});
