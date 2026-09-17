import { CONCURRENCY_CONFIG } from "../config/runtimeConfig.js";

export class ConcurrencyLimitError extends Error {
  constructor(message, code = "router_overloaded", status = 503) {
    super(message);
    this.name = "ConcurrencyLimitError";
    this.code = code;
    this.status = status;
  }
}

function makeAbortError(reason) {
  const error = new Error(reason?.message || (typeof reason === "string" ? reason : "Request aborted"));
  error.name = "AbortError";
  return error;
}

// Global state
let activeGlobal = 0;
const activeByProvider = new Map(); // provider -> count
const activeByConnection = new Map(); // connectionKey -> count
const queue = []; // FIFO queue of waiting request objects

function getActiveCount(map, key) {
  if (!key) return 0;
  return map.get(key) || 0;
}

function incrementMap(map, key) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function decrementMap(map, key) {
  if (!key) return;
  const current = map.get(key) || 0;
  if (current <= 1) {
    map.delete(key);
  } else {
    map.set(key, current - 1);
  }
}

function canAdmit(provider, connectionId) {
  const { globalMax, providerMax, connectionMax } = CONCURRENCY_CONFIG;
  if (globalMax > 0 && activeGlobal >= globalMax) {
    return false;
  }
  if (provider && providerMax > 0 && getActiveCount(activeByProvider, provider) >= providerMax) {
    return false;
  }
  if (connectionId && connectionMax > 0) {
    const connKey = provider ? `${provider}:${connectionId}` : connectionId;
    if (getActiveCount(activeByConnection, connKey) >= connectionMax) {
      return false;
    }
  }
  return true;
}

function takeSlot(provider, connectionId) {
  activeGlobal++;
  if (provider) incrementMap(activeByProvider, provider);
  if (connectionId) {
    const connKey = provider ? `${provider}:${connectionId}` : connectionId;
    incrementMap(activeByConnection, connKey);
  }

  let released = false;
  return function release() {
    if (released) return;
    released = true;

    activeGlobal = Math.max(0, activeGlobal - 1);
    if (provider) decrementMap(activeByProvider, provider);
    if (connectionId) {
      const connKey = provider ? `${provider}:${connectionId}` : connectionId;
      decrementMap(activeByConnection, connKey);
    }

    drainQueue();
  };
}

function drainQueue() {
  // Fair FIFO: scan queue from the front for the first waiter that can be admitted.
  // Note: we wake at most one waiter per freed slot.
  for (let i = 0; i < queue.length; i++) {
    const waiter = queue[i];
    if (canAdmit(waiter.provider, waiter.connectionId)) {
      queue.splice(i, 1);
      waiter.grant();
      break;
    }
  }
}

export async function acquireSlot({ provider, connectionId, signal } = {}) {
  // If signal already aborted, reject immediately without acquiring or queuing
  if (signal?.aborted) {
    throw makeAbortError(signal.reason);
  }

  if (canAdmit(provider, connectionId)) {
    return takeSlot(provider, connectionId);
  }

  // Slot cannot be granted immediately: enqueue if queue is not full
  const { queueMax, queueTimeoutMs } = CONCURRENCY_CONFIG;
  if (queueMax > 0 && queue.length >= queueMax) {
    throw new ConcurrencyLimitError("Inbound concurrency queue is full; router overloaded", "router_overloaded", 503);
  }

  return new Promise((resolve, reject) => {
    let timer = null;
    let abortListener = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (signal && abortListener) {
        signal.removeEventListener("abort", abortListener);
        abortListener = null;
      }
    };

    const removeFromQueue = () => {
      const idx = queue.findIndex(w => w === waiter);
      if (idx !== -1) {
        queue.splice(idx, 1);
      }
    };

    const waiter = {
      provider,
      connectionId,
      grant() {
        cleanup();
        const release = takeSlot(provider, connectionId);
        // If aborted between scheduling and grant invocation
        if (signal?.aborted) {
          release();
          reject(makeAbortError(signal.reason));
          return;
        }
        resolve(release);
      }
    };

    if (queueTimeoutMs > 0) {
      timer = setTimeout(() => {
        cleanup();
        removeFromQueue();
        reject(new ConcurrencyLimitError(`Concurrency slot acquisition timed out after ${queueTimeoutMs}ms`, "router_overloaded", 503));
      }, queueTimeoutMs);
    }

    if (signal) {
      abortListener = () => {
        cleanup();
        removeFromQueue();
        reject(makeAbortError(signal.reason));
      };
      signal.addEventListener("abort", abortListener, { once: true });
    }

    queue.push(waiter);
  });
}

export function getConcurrencyStats() {
  const byProvider = {};
  for (const [p, count] of activeByProvider.entries()) {
    byProvider[p] = count;
  }
  return {
    active: activeGlobal,
    queued: queue.length,
    byProvider
  };
}

// Test helper to reset internal counters if needed
export function _resetConcurrencyLimiter() {
  activeGlobal = 0;
  activeByProvider.clear();
  activeByConnection.clear();
  queue.length = 0;
}
