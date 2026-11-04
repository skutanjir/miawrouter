const { err, createResponseDumper } = require("../logger");
const { ENABLE_FILE_LOG } = require("../config");
const { fetchRouter, pipeSSE } = require("./base");

/**
 * Intercept Antigravity request — forward Gemini body as-is to /v1/chat/completions.
 * Router auto-detects format via body.userAgent==="antigravity" + body.request.contents,
 * runs antigravity→openai→provider→openai→antigravity translators internally.
 */
async function intercept(req, res, bodyBuffer, mappedModel) {
  const dumper = ENABLE_FILE_LOG ? createResponseDumper(req, "intercept-antigravity") : null;
  const controller = new AbortController();
  const onClose = () => { if (!res.writableFinished) controller.abort(); };
  res.on?.("close", onClose);
  try {
    const body = JSON.parse(bodyBuffer.toString());
    body.model = mappedModel || body.model;

    const routerRes = await fetchRouter(body, "/v1/chat/completions", req.headers, controller.signal);
    await pipeSSE(routerRes, res, dumper);
  } catch (error) {
    if (controller.signal.aborted) return;
    err(`[antigravity] ${error.message}`);
    if (dumper) { dumper.writeChunk(`\n[ERROR] ${error.message}\n`); dumper.end(); }
    if (res.headersSent) {
      res.destroy(error);
    } else {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: error.message, type: "mitm_error" } }));
    }
  } finally {
    res.off?.("close", onClose);
  }
}

module.exports = { intercept };
