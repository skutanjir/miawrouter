const { log, err } = require("../logger");

const DEFAULT_LOCAL_ROUTER = "http://localhost:21128";
const ROUTER_BASE = String(process.env.MITM_ROUTER_BASE || DEFAULT_LOCAL_ROUTER)
  .trim()
  .replace(/\/+$/, "") || DEFAULT_LOCAL_ROUTER;
const API_KEY = process.env.ROUTER_API_KEY;

// Headers that must not be forwarded to MiawRouter
const STRIP_HEADERS = new Set([
  "host", "content-length", "connection", "transfer-encoding",
  "content-type", "content-encoding", "authorization", "te",
  "connect-content-encoding", "connect-accept-encoding", "connect-protocol-version"
]);

/**
 * Send body to MiawRouter at the given path and return the fetch Response object.
 * Optionally forwards client headers (stripped of hop-by-hop / overridden keys).
 */
async function fetchRouter(openaiBody, path = "/v1/chat/completions", clientHeaders = {}) {
  const forwarded = {};
  for (const [k, v] of Object.entries(clientHeaders)) {
    if (!k.startsWith(":") && !STRIP_HEADERS.has(k.toLowerCase())) forwarded[k] = v;
  }

  const response = await fetch(`${ROUTER_BASE}${path}`, {
    method: "POST",
    headers: {
      ...forwarded,
      "Content-Type": "application/json",
      ...(API_KEY && { "Authorization": `Bearer ${API_KEY}` })
    },
    body: JSON.stringify(openaiBody)
  });

  // Forward response as-is (status + body). pipeSSE will propagate status.
  return response;
}

/**
 * Pipe SSE stream from router directly to client response.
 * Optional dumper tees the stream into a debug file.
 */
async function pipeSSE(routerRes, res, dumper) {
  const ct = routerRes.headers.get("content-type") || "application/json";
  const status = routerRes.status || 200;
  const resHeaders = { "Content-Type": ct, "Cache-Control": "no-cache", "Connection": "keep-alive" };
  if (ct.includes("text/event-stream")) resHeaders["X-Accel-Buffering"] = "no";
  res.writeHead(status, resHeaders);
  if (dumper) dumper.writeHeader(routerRes.status, Object.fromEntries(routerRes.headers));

  if (!routerRes.body) {
    const text = await routerRes.text().catch(() => "");
    if (dumper) { dumper.writeChunk(text); dumper.end(); }
    res.end(text);
    return;
  }

  const reader = routerRes.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) { if (dumper) dumper.end(); res.end(); break; }
    if (dumper) dumper.writeChunk(value);
    res.write(decoder.decode(value, { stream: true }));
  }
}

/**
 * Pipe SSE stream from router, transforming each chunk through a user function.
 * Reads SSE data: lines, parses JSON, calls transformFn(parsed, state),
 * and writes returned SSE strings to the client response.
 *
 * @param {Response} routerRes - Fetch Response from MiawRouter
 * @param {http.ServerResponse} res - Client response
 * @param {Function} transformFn - (parsedChunk, state) => string|string[]|null
 * @param {object} state - Mutable state object shared across chunks and flush
 */
async function pipeTransformedSSE(routerRes, res, transformFn, state) {
  const ct = routerRes.headers.get("content-type") || "application/json";
  const resHeaders = { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" };
  resHeaders["X-Accel-Buffering"] = "no";
  const status = routerRes.status || 200;
  res.writeHead(status, resHeaders);

  if (!routerRes.body) {
    res.end(await routerRes.text().catch(() => ""));
    return;
  }

  // Preserve router errors; they are JSON, not SSE.
  if (status < 200 || status >= 300 || !ct.includes("text/event-stream")) {
    res.end(await routerRes.text().catch(() => ""));
    return;
  }

  const reader = routerRes.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let buffer = "";
  const writeOutput = (output) => {
    if (typeof output === "string" || Buffer.isBuffer(output) || output instanceof Uint8Array) {
      res.write(output);
    } else {
      res.write(`data: ${JSON.stringify(output)}\r\n\r\n`);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;

      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;

      if (process.env.DEBUG_MITM) {
        log(`[SSE in] ${data.slice(0, 200)}`);
      }

      try {
        const parsed = JSON.parse(data);
        const result = transformFn(parsed, state);
        if (result != null) {
          const outputs = Array.isArray(result) ? result : [result];
          for (const output of outputs) {
            if (process.env.DEBUG_MITM) {
              const len = output.length || output.byteLength || 0;
              log(`[write binary frame] (${len}B) first 20B: ${Array.from(output.slice(0, 20)).join(',')}`);
            }
            writeOutput(output);
          }
        }
      } catch {
        // Skip unparseable lines
      }
    }
  }

  // Process a final unterminated SSE line before flushing the translator.
  const tail = buffer.trim();
  if (tail.startsWith("data:") && tail.slice(5).trim() !== "[DONE]") {
    try {
      const result = transformFn(JSON.parse(tail.slice(5).trim()), state);
      if (result != null) for (const output of (Array.isArray(result) ? result : [result])) writeOutput(output);
    } catch (error) {
      log(`[SSE transform] final chunk ignored: ${error.message}`);
    }
  }

  // Flush: pass null to signal stream end
  try {
    const flushed = transformFn(null, state);
    if (flushed != null) {
      const outputs = Array.isArray(flushed) ? flushed : [flushed];
      for (const output of outputs) {
        writeOutput(output);
      }
    }
  } catch { /* ignore flush errors */ }

  res.end();
}

/**
 * Pipe SSE stream from router, transforming each chunk through a user function,
 * and writing binary EventStream frames to the client.
 *
 * Reads SSE data: lines, parses JSON, calls transformFn(parsed, state),
 * and writes returned Uint8Array frames to the client response.
 *
 * @param {Response} routerRes - Fetch Response from MiawRouter
 * @param {http.ServerResponse} res - Client response
 * @param {Function} transformFn - (parsedChunk, state) => Uint8Array|Uint8Array[]|null
 * @param {object} state - Mutable state object shared across chunks and flush
 */
async function pipeTransformedEventStream(routerRes, res, transformFn, state) {
  const resHeaders = {
    "Content-Type": "application/vnd.amazon.eventstream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  };
  res.writeHead(200, resHeaders);

  if (!routerRes.body) {
    res.end(await routerRes.text().catch(() => ""));
    return;
  }

  const reader = routerRes.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;

      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;

      if (process.env.DEBUG_MITM) {
        log(`[SSE in] ${data.slice(0, 200)}`);
      }

      try {
        const parsed = JSON.parse(data);
        const result = transformFn(parsed, state);
        if (result != null) {
          const outputs = Array.isArray(result) ? result : [result];
          for (const output of outputs) {
            if (process.env.DEBUG_MITM) {
              const len = output.length || output.byteLength || 0;
              log(`[write binary frame] (${len}B) first 20B: ${Array.from(output.slice(0, 20)).join(',')}`);
            }
            res.write(Buffer.from(output));
          }
        }
      } catch {
        // Skip unparseable lines
      }
    }
  }

  // Flush: pass null to signal stream end
  try {
    const flushed = transformFn(null, state);
    if (flushed != null) {
      const outputs = Array.isArray(flushed) ? flushed : [flushed];
      for (const output of outputs) {
        res.write(output);
      }
    }
  } catch { /* ignore flush errors */ }

  res.end();
}

module.exports = { fetchRouter, pipeSSE, pipeTransformedSSE, pipeTransformedEventStream };
