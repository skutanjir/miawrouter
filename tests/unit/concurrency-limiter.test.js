import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  acquireSlot,
  getConcurrencyStats,
  ConcurrencyLimitError,
  _resetConcurrencyLimiter,
} from "../../open-sse/services/concurrencyLimiter.js";
import { CONCURRENCY_CONFIG } from "../../open-sse/config/runtimeConfig.js";
import { isCircuitBlocked } from "../../open-sse/services/circuitBreaker.js";

// Mock the network layer for BaseExecutor testing
const fetchMock = vi.fn();
vi.mock("../../open-sse/utils/proxyFetch.js", () => ({
  proxyAwareFetch: (...args) => fetchMock(...args),
}));

const { BaseExecutor } = await import("../../open-sse/executors/base.js");

beforeEach(() => {
  _resetConcurrencyLimiter();
  fetchMock.mockReset();
});

describe("concurrencyLimiter unit tests", () => {
  it("enforces capacity per level: global, provider, connection", async () => {
    // Save original configs
    const origGlobal = CONCURRENCY_CONFIG.globalMax;
    const origProvider = CONCURRENCY_CONFIG.providerMax;
    const origConn = CONCURRENCY_CONFIG.connectionMax;
    const origQueue = CONCURRENCY_CONFIG.queueMax;

    try {
      CONCURRENCY_CONFIG.globalMax = 3;
      CONCURRENCY_CONFIG.providerMax = 2;
      CONCURRENCY_CONFIG.connectionMax = 1;
      CONCURRENCY_CONFIG.queueMax = 1; // max 1 in queue

      // Test connectionMax: provider A, conn 1
      const rel1 = await acquireSlot({ provider: "provA", connectionId: "c1" });
      expect(getConcurrencyStats().active).toBe(1);
      expect(getConcurrencyStats().byProvider["provA"]).toBe(1);

      // Same provider and connection -> cannot be admitted immediately.
      // Waiter enqueued (1 in queue). Next one exceeds queueMax (1) -> throws.
      const queuedPromise = acquireSlot({ provider: "provA", connectionId: "c1" });
      expect(getConcurrencyStats().queued).toBe(1);

      await expect(acquireSlot({ provider: "provA", connectionId: "c1" })).rejects.toThrow(ConcurrencyLimitError);

      // Clean up queued promise by releasing rel1
      rel1();
      const rel1b = await queuedPromise;
      expect(getConcurrencyStats().queued).toBe(0);

      // Provider B, conn 1 -> active = 2
      const rel2 = await acquireSlot({ provider: "provB", connectionId: "c1" });
      expect(getConcurrencyStats().active).toBe(2);

      // Provider C, conn 1 -> active = 3 (global max is 3)
      const rel3 = await acquireSlot({ provider: "provC", connectionId: "c1" });
      expect(getConcurrencyStats().active).toBe(3);

      // Any further request will queue up to queueMax (1), next throws
      const queuedGlobal = acquireSlot({ provider: "provD", connectionId: "c1" });
      expect(getConcurrencyStats().queued).toBe(1);
      await expect(acquireSlot({ provider: "provE", connectionId: "c1" })).rejects.toThrow(ConcurrencyLimitError);

      // Release slots
      rel1b();
      const rel4 = await queuedGlobal;
      expect(getConcurrencyStats().queued).toBe(0);

      rel2();
      rel3();
      rel4();

      expect(getConcurrencyStats().active).toBe(0);
      expect(getConcurrencyStats().byProvider["provA"]).toBeUndefined();
    } finally {
      CONCURRENCY_CONFIG.globalMax = origGlobal;
      CONCURRENCY_CONFIG.providerMax = origProvider;
      CONCURRENCY_CONFIG.connectionMax = origConn;
      CONCURRENCY_CONFIG.queueMax = origQueue;
    }
  });

  it("fair FIFO: queued requests are served in order", async () => {
    const origGlobal = CONCURRENCY_CONFIG.globalMax;
    const origQueue = CONCURRENCY_CONFIG.queueMax;

    try {
      CONCURRENCY_CONFIG.globalMax = 1;
      CONCURRENCY_CONFIG.queueMax = 10;

      const rel1 = await acquireSlot({ provider: "p1" });

      const order = [];
      const p2 = acquireSlot({ provider: "p1" }).then((rel) => {
        order.push("second");
        return rel;
      });
      const p3 = acquireSlot({ provider: "p1" }).then((rel) => {
        order.push("third");
        return rel;
      });

      expect(getConcurrencyStats().active).toBe(1);
      expect(getConcurrencyStats().queued).toBe(2);

      // Release first slot -> should wake second
      rel1();
      const rel2 = await p2;
      expect(order).toEqual(["second"]);
      expect(getConcurrencyStats().queued).toBe(1);

      // Release second slot -> should wake third
      rel2();
      const rel3 = await p3;
      expect(order).toEqual(["second", "third"]);
      expect(getConcurrencyStats().queued).toBe(0);

      rel3();
      expect(getConcurrencyStats().active).toBe(0);
    } finally {
      CONCURRENCY_CONFIG.globalMax = origGlobal;
      CONCURRENCY_CONFIG.queueMax = origQueue;
    }
  });

  it("queue-full throws typed 503 error", async () => {
    const origGlobal = CONCURRENCY_CONFIG.globalMax;
    const origQueue = CONCURRENCY_CONFIG.queueMax;

    try {
      CONCURRENCY_CONFIG.globalMax = 1;
      CONCURRENCY_CONFIG.queueMax = 1;

      const rel = await acquireSlot({ provider: "p1" });

      // First queued request
      const pWait = acquireSlot({ provider: "p1" });
      expect(getConcurrencyStats().queued).toBe(1);

      // Second queued request exceeds queueMax (1)
      let thrownError = null;
      try {
        await acquireSlot({ provider: "p1" });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(ConcurrencyLimitError);
      expect(thrownError.code).toBe("router_overloaded");
      expect(thrownError.status).toBe(503);

      rel();
      const nextRel = await pWait;
      nextRel();
    } finally {
      CONCURRENCY_CONFIG.globalMax = origGlobal;
      CONCURRENCY_CONFIG.queueMax = origQueue;
    }
  });

  it("queue timeout rejects with typed 503 error", async () => {
    const origGlobal = CONCURRENCY_CONFIG.globalMax;
    const origTimeout = CONCURRENCY_CONFIG.queueTimeoutMs;

    try {
      CONCURRENCY_CONFIG.globalMax = 1;
      CONCURRENCY_CONFIG.queueTimeoutMs = 30; // 30ms timeout

      const rel = await acquireSlot({ provider: "p1" });

      let thrownError = null;
      try {
        await acquireSlot({ provider: "p1" });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(ConcurrencyLimitError);
      expect(thrownError.code).toBe("router_overloaded");
      expect(thrownError.status).toBe(503);
      expect(thrownError.message).toContain("timed out");
      expect(getConcurrencyStats().queued).toBe(0);

      rel();
    } finally {
      CONCURRENCY_CONFIG.globalMax = origGlobal;
      CONCURRENCY_CONFIG.queueTimeoutMs = origTimeout;
    }
  });

  it("abort while queued frees the queue immediately (no leak)", async () => {
    const origGlobal = CONCURRENCY_CONFIG.globalMax;

    try {
      CONCURRENCY_CONFIG.globalMax = 1;

      const rel = await acquireSlot({ provider: "p1" });

      const ctrl = new AbortController();
      const waitPromise = acquireSlot({ provider: "p1", signal: ctrl.signal });

      expect(getConcurrencyStats().queued).toBe(1);

      ctrl.abort(new Error("client canceled"));

      let thrown = null;
      try {
        await waitPromise;
      } catch (e) {
        thrown = e;
      }

      expect(thrown?.name).toBe("AbortError");
      expect(getConcurrencyStats().queued).toBe(0);
      expect(getConcurrencyStats().active).toBe(1);

      rel();
      expect(getConcurrencyStats().active).toBe(0);
    } finally {
      CONCURRENCY_CONFIG.globalMax = origGlobal;
    }
  });

  it("double release is a no-op and wakes exactly one waiter", async () => {
    const origGlobal = CONCURRENCY_CONFIG.globalMax;

    try {
      CONCURRENCY_CONFIG.globalMax = 1;

      const rel = await acquireSlot({ provider: "p1" });

      let waitCount = 0;
      acquireSlot({ provider: "p1" }).then((r) => {
        waitCount++;
        r();
      });

      // Call release multiple times
      rel();
      rel();
      rel();

      // Wait a microtask tick
      await new Promise((r) => setTimeout(r, 10));

      expect(waitCount).toBe(1);
      expect(getConcurrencyStats().active).toBe(0);
    } finally {
      CONCURRENCY_CONFIG.globalMax = origGlobal;
    }
  });
});

describe("BaseExecutor streaming concurrency regression test", () => {
  it("releases the slot after the streaming body is consumed", async () => {
    const origGlobal = CONCURRENCY_CONFIG.globalMax;

    try {
      CONCURRENCY_CONFIG.globalMax = 1;

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("data: hello\n\n"));
          controller.close();
        },
      });

      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: { get: () => "text/event-stream" },
        body: stream,
      });

      const executor = new BaseExecutor("test-prov", { baseUrl: "https://api.test/v1" });
      const result = await executor.execute({
        model: "gpt-4",
        body: {},
        stream: true,
        credentials: { apiKey: "test-key", connectionId: "conn-1" },
      });

      // Upstream fetch returned response, but stream is NOT consumed yet!
      expect(getConcurrencyStats().active).toBe(1);
      expect(getConcurrencyStats().byProvider["test-prov"]).toBe(1);

      // Now consume the body stream completely
      const reader = result.response.body.getReader();
      let readDone = false;
      while (!readDone) {
        const { done } = await reader.read();
        readDone = done;
      }

      // Slot must now be released!
      expect(getConcurrencyStats().active).toBe(0);
      expect(getConcurrencyStats().byProvider["test-prov"]).toBeUndefined();
    } finally {
      CONCURRENCY_CONFIG.globalMax = origGlobal;
    }
  });

  it("releases the slot when streaming body is cancelled", async () => {
    const origGlobal = CONCURRENCY_CONFIG.globalMax;

    try {
      CONCURRENCY_CONFIG.globalMax = 1;

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("chunk"));
        },
      });

      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: { get: () => "text/event-stream" },
        body: stream,
      });

      const executor = new BaseExecutor("test-prov", { baseUrl: "https://api.test/v1" });
      const result = await executor.execute({
        model: "gpt-4",
        body: {},
        stream: true,
        credentials: { apiKey: "test-key" },
      });

      expect(getConcurrencyStats().active).toBe(1);

      // Cancel stream
      const reader = result.response.body.getReader();
      await reader.cancel("abort stream");

      // Slot must be released
      expect(getConcurrencyStats().active).toBe(0);
    } finally {
      CONCURRENCY_CONFIG.globalMax = origGlobal;
    }
  });

  it("releases the slot immediately for non-streaming response", async () => {
    const origGlobal = CONCURRENCY_CONFIG.globalMax;

    try {
      CONCURRENCY_CONFIG.globalMax = 1;

      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: { get: () => "application/json" },
        body: null,
      });

      const executor = new BaseExecutor("test-prov", { baseUrl: "https://api.test/v1" });
      const result = await executor.execute({
        model: "gpt-4",
        body: {},
        stream: false,
        credentials: { apiKey: "test-key" },
      });

      expect(result.response.status).toBe(200);
      expect(getConcurrencyStats().active).toBe(0);
    } finally {
      CONCURRENCY_CONFIG.globalMax = origGlobal;
    }
  });

  it("sheds load with a 503 instead of retrying or penalising the provider", async () => {
    const orig = {
      globalMax: CONCURRENCY_CONFIG.globalMax,
      queueTimeoutMs: CONCURRENCY_CONFIG.queueTimeoutMs,
    };

    try {
      CONCURRENCY_CONFIG.globalMax = 1;
      CONCURRENCY_CONFIG.queueTimeoutMs = 5;

      // Occupy the only slot so the executor has to queue.
      const held = await acquireSlot({ provider: "other-prov" });

      const executor = new BaseExecutor("test-prov", {
        baseUrl: "https://api.test/v1",
        retry: { 503: { attempts: 3, delayMs: 1 } },
      });

      let caught = null;
      try {
        await executor.execute({
          model: "gpt-4",
          body: {},
          stream: false,
          credentials: { apiKey: "test-key" },
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(ConcurrencyLimitError);
      expect(caught.status).toBe(503);
      // Router overload is not a transport failure: never dial upstream.
      expect(fetchMock).not.toHaveBeenCalled();
      // ...and it must not be recorded as provider ill-health.
      expect(isCircuitBlocked("test-prov", null)).toBe(false);

      held();
      expect(getConcurrencyStats().active).toBe(0);
      expect(getConcurrencyStats().queued).toBe(0);
    } finally {
      CONCURRENCY_CONFIG.globalMax = orig.globalMax;
      CONCURRENCY_CONFIG.queueTimeoutMs = orig.queueTimeoutMs;
    }
  });

  it("propagates a client abort while queued without dialling upstream", async () => {
    const origGlobal = CONCURRENCY_CONFIG.globalMax;

    try {
      CONCURRENCY_CONFIG.globalMax = 1;
      const held = await acquireSlot({ provider: "other-prov" });

      const controller = new AbortController();
      const executor = new BaseExecutor("test-prov", { baseUrl: "https://api.test/v1" });

      const pending = executor.execute({
        model: "gpt-4",
        body: {},
        stream: false,
        credentials: { apiKey: "test-key" },
        signal: controller.signal,
      });
      // Let the executor reach the queue, then abort.
      await new Promise((r) => setTimeout(r, 0));
      controller.abort();

      let caught = null;
      try {
        await pending;
      } catch (error) {
        caught = error;
      }

      expect(caught?.name).toBe("AbortError");
      expect(fetchMock).not.toHaveBeenCalled();
      expect(getConcurrencyStats().queued).toBe(0);

      held();
      expect(getConcurrencyStats().active).toBe(0);
    } finally {
      CONCURRENCY_CONFIG.globalMax = origGlobal;
    }
  });
});
