import { REQUEST_LIMITS } from "../config/runtimeConfig.js";

/**
 * Estimate serialized body bytes without re-reading the request stream.
 * @param {any} body
 * @returns {number}
 */
export function estimateBodyBytes(body) {
  if (body == null) return 0;
  if (typeof body === "string") return Buffer.byteLength(body, "utf8");
  try {
    return Buffer.byteLength(JSON.stringify(body), "utf8");
  } catch {
    return 0;
  }
}

/**
 * Check request content-length header against maxBodyBytes early.
 * @param {Request} request
 * @param {object} [limits]
 * @returns {{ ok: boolean, status?: number, message?: string }}
 */
export function assertJsonBodySize(request, limits = REQUEST_LIMITS) {
  const maxBytes = limits?.maxBodyBytes || 0;
  if (maxBytes <= 0 || !request?.headers) {
    return { ok: true };
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const parsedLength = parseInt(contentLengthHeader, 10);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      return {
        ok: false,
        status: 413,
        message: `Request payload too large: ${parsedLength} bytes exceeds limit of ${maxBytes} bytes.`
      };
    }
  }

  return { ok: true };
}

/**
 * Validate structural properties of an inbound chat completion request body.
 * Strictly permissive about provider extensions.
 * @param {any} body
 * @returns {{ ok: boolean, status?: number, message?: string }}
 */
export function validateChatRequest(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      status: 400,
      message: "Invalid request body: body must be a JSON object."
    };
  }

  if (body.model !== undefined && body.model !== null && body.model !== "") {
    if (typeof body.model !== "string") {
      return {
        ok: false,
        status: 400,
        message: "Invalid request body: 'model' must be a string."
      };
    }
  }

  const hasMessages = "messages" in body;
  const hasInput = "input" in body;
  const hasPrompt = "prompt" in body;
  const hasAntigravityRequest = body.userAgent === "antigravity"
    && body.request !== null
    && typeof body.request === "object"
    && Array.isArray(body.request.contents);

  if (!hasMessages && !hasInput && !hasPrompt && !hasAntigravityRequest) {
    return {
      ok: false,
      status: 400,
      message: "Invalid request body: at least one of 'messages', 'input', or 'prompt' must be provided."
    };
  }

  if (hasMessages) {
    if (!Array.isArray(body.messages)) {
      return {
        ok: false,
        status: 400,
        message: "Invalid request body: 'messages' must be an array."
      };
    }
    for (let i = 0; i < body.messages.length; i++) {
      const msg = body.messages[i];
      if (msg === null || typeof msg !== "object" || Array.isArray(msg)) {
        return {
          ok: false,
          status: 400,
          message: `Invalid request body: messages[${i}] must be an object.`
        };
      }
    }
  }

  if (hasInput) {
    if (!Array.isArray(body.input)) {
      return {
        ok: false,
        status: 400,
        message: "Invalid request body: 'input' must be an array."
      };
    }
  }

  if (hasPrompt) {
    if (!Array.isArray(body.prompt) && typeof body.prompt !== "string") {
      return {
        ok: false,
        status: 400,
        message: "Invalid request body: 'prompt' must be a string or an array."
      };
    }
  }

  if ("stream" in body && body.stream !== undefined && typeof body.stream !== "boolean") {
    return {
      ok: false,
      status: 400,
      message: "Invalid request body: 'stream' must be a boolean."
    };
  }

  if ("tools" in body && body.tools !== undefined && body.tools !== null) {
    if (!Array.isArray(body.tools)) {
      return {
        ok: false,
        status: 400,
        message: "Invalid request body: 'tools' must be an array."
      };
    }
    for (let i = 0; i < body.tools.length; i++) {
      const tool = body.tools[i];
      if (tool === null || typeof tool !== "object" || Array.isArray(tool)) {
        return {
          ok: false,
          status: 400,
          message: `Invalid request body: tools[${i}] must be an object.`
        };
      }
    }
  }

  const numericFields = ["max_tokens", "max_completion_tokens", "temperature", "top_p"];
  for (const field of numericFields) {
    if (field in body && body[field] !== undefined && body[field] !== null) {
      if (typeof body[field] !== "number" || !Number.isFinite(body[field])) {
        return {
          ok: false,
          status: 400,
          message: `Invalid request body: '${field}' must be a finite number.`
        };
      }
    }
  }

  return { ok: true };
}

/**
 * Enforce resource limits (messages count, tools count, tools schema size).
 * @param {any} body
 * @param {object} [limits]
 * @returns {{ ok: boolean, status?: number, message?: string }}
 */
export function enforceLimits(body, limits = REQUEST_LIMITS) {
  if (!body || typeof body !== "object") {
    return { ok: true };
  }

  const maxMessages = limits?.maxMessages || 0;
  if (maxMessages > 0 && Array.isArray(body.messages) && body.messages.length > maxMessages) {
    return {
      ok: false,
      status: 413,
      message: `Payload Too Large: message count ${body.messages.length} exceeds limit of ${maxMessages}.`
    };
  }

  const maxTools = limits?.maxTools || 0;
  if (maxTools > 0 && Array.isArray(body.tools) && body.tools.length > maxTools) {
    return {
      ok: false,
      status: 413,
      message: `Payload Too Large: tools count ${body.tools.length} exceeds limit of ${maxTools}.`
    };
  }

  const maxToolSchemaBytes = limits?.maxToolSchemaBytes || 0;
  if (maxToolSchemaBytes > 0 && Array.isArray(body.tools)) {
    let schemaBytes = 0;
    try {
      schemaBytes = Buffer.byteLength(JSON.stringify(body.tools), "utf8");
    } catch {
      schemaBytes = 0;
    }
    if (schemaBytes > maxToolSchemaBytes) {
      return {
        ok: false,
        status: 413,
        message: `Payload Too Large: tools schema size of ${schemaBytes} bytes exceeds limit of ${maxToolSchemaBytes} bytes.`
      };
    }
  }

  return { ok: true };
}
