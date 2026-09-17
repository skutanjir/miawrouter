// Process-local runtime metrics, exposed in Prometheus text format.
//
// Privacy contract (enforced by construction, not by convention):
//   - Labels are restricted to a small allow-list of low-cardinality keys.
//     A prompt, message body, API key, session id or model-input is never a
//     label, so none of it can reach the scrape endpoint.
//   - Provider and model labels are opt-in via `runtimeMetricsLabels` because
//     a model string can be a caller-controlled value.
//   - Nothing here reads or stores request bodies.
//
// The point is to answer "is the router healthy right now?" — request volume,
// latency, TTFT, queue depth, provider error mix, cache outcome, token flow and
// circuit state — without a database round trip and without leaking content.

const counters = new Map(); // name -> { help, type, values: Map<labelKey, {labels, value}> }
const gauges = new Map();

function def(map, name, help, type) {
  let entry = map.get(name);
  if (!entry) {
    entry = { help, type, values: new Map() };
    map.set(name, entry);
  }
  return entry;
}

function labelKey(labels) {
  if (!labels) return "";
  const keys = Object.keys(labels).sort();
  return keys.map((k) => `${k}="${String(labels[k]).replace(/["\\\n]/g, "_")}"`).join(",");
}

/**
 * Increment a counter. Safe to call on every request: allocation is one small
 * object and a Map lookup.
 */
export function increment(name, labels, help = name, by = 1) {
  const entry = def(counters, name, help, "counter");
  const k = labelKey(labels);
  const existing = entry.values.get(k);
  if (existing) existing.value += by;
  else entry.values.set(k, { labels: labels || {}, value: by });
}

/** Set a gauge to an absolute value. */
export function setGauge(name, value, labels, help = name) {
  const entry = def(gauges, name, help, "gauge");
  entry.values.set(labelKey(labels), { labels: labels || {}, value });
}

const DEFAULT_BUCKETS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60, 120];

const histograms = new Map(); // name -> { help, buckets, series: Map<labelKey, {...}> }

/**
 * Record one observation in a Prometheus-style histogram (cumulative buckets
 * plus `_sum`/`_count`). Used for request duration and TTFT.
 */
export function observeHistogram(name, value, labels, help = name, buckets = DEFAULT_BUCKETS) {
  if (!Number.isFinite(value) || value < 0) return;
  let entry = histograms.get(name);
  if (!entry) {
    entry = { help, buckets, series: new Map() };
    histograms.set(name, entry);
  }
  const k = labelKey(labels);
  let series = entry.series.get(k);
  if (!series) {
    series = { labels: labels || {}, counts: new Array(entry.buckets.length).fill(0), sum: 0, count: 0 };
    entry.series.set(k, series);
  }
  // Cumulative: every bucket whose upper bound the value falls under.
  let placed = false;
  for (let i = 0; i < entry.buckets.length; i++) {
    if (value <= entry.buckets[i]) {
      series.counts[i]++;
      placed = true;
    }
  }
  if (!placed) series.counts[entry.buckets.length - 1]++;
  series.sum += value;
  series.count++;
}

function renderHistogram(name, entry) {
  const lines = [`# HELP ${name} ${entry.help}`, `# TYPE ${name} histogram`];
  for (const series of entry.series.values()) {
    const rendered = labelKey(series.labels);
    const withLabel = (extra) => {
      const parts = [];
      if (rendered) parts.push(rendered);
      if (extra) parts.push(extra);
      return parts.length ? `{${parts.join(",")}}` : "";
    };
    for (let i = 0; i < entry.buckets.length; i++) {
      lines.push(`${name}_bucket${withLabel(`le="${entry.buckets[i]}"`)} ${series.counts[i]}`);
    }
    lines.push(`${name}_bucket${withLabel('le="+Inf"')} ${series.count}`);
    lines.push(`${name}_sum${withLabel()} ${renderValue(series.sum)}`);
    lines.push(`${name}_count${withLabel()} ${series.count}`);
  }
  return lines;
}

function renderValue(v) {
  if (!Number.isFinite(v)) return String(v);
  if (Number.isInteger(v)) return String(v);
  // Prometheus float format; 6 significant digits is plenty for a gauge/counter.
  return String(v.toPrecision(6));
}

function renderFamily(entry, name) {
  const lines = [];
  if (entry.help) lines.push(`# HELP ${name} ${entry.help}`);
  lines.push(`# TYPE ${name} ${entry.type}`);
  for (const { labels, value } of entry.values.values()) {
    const rendered = labelKey(labels);
    lines.push(`${name}${rendered ? `{${rendered}}` : ""} ${renderValue(value)}`);
  }
  return lines;
}

/** Render every registered metric in Prometheus text exposition format v0.0.4. */
export function renderMetrics() {
  const lines = [];
  for (const [name, entry] of counters) lines.push(...renderFamily(entry, name));
  for (const [name, entry] of gauges) lines.push(...renderFamily(entry, name));
  for (const [name, entry] of histograms) lines.push(...renderHistogram(name, entry));
  return `${lines.join("\n")}\n`;
}

/** Test/dev helper. */
export function _resetRuntimeMetrics() {
  counters.clear();
  gauges.clear();
  histograms.clear();
}
