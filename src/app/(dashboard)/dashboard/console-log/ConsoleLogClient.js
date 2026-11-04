"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/shared/components";
import { CONSOLE_LOG_CONFIG } from "@/shared/constants/config";

const LOG_LEVEL_COLORS = {
  LOG: "text-text-main",
  INFO: "text-primary",
  WARN: "text-warning",
  ERROR: "text-danger",
  DEBUG: "text-text-muted",
};


function colorLine(line) {
  const match = line.match(/\[(\w+)\]/g);
  const levelTag = match ? match[1]?.replace(/\[|\]/g, "") : null;
  const color = LOG_LEVEL_COLORS[levelTag] || "text-text-main";
  return <span className={color}>{line}</span>;
}

export default function ConsoleLogClient() {
  const [logs, setLogs] = useState([]);
  const [connected, setConnected] = useState(false);
  const [levelFilter, setLevelFilter] = useState("all");
  const logRef = useRef(null);

  const handleClear = async () => {
    try {
      await fetch("/api/translator/console-logs", { method: "DELETE" });
      // UI cleared via SSE "clear" event
    } catch (err) {
      console.error("Failed to clear console logs:", err);
    }
  };

  useEffect(() => {
    const es = new EventSource("/api/translator/console-logs/stream");

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "init") {
        setLogs(msg.logs.slice(-CONSOLE_LOG_CONFIG.maxLines));
      } else if (msg.type === "line") {
        setLogs((prev) => {
          const next = [...prev, msg.line];
          return next.length > CONSOLE_LOG_CONFIG.maxLines ? next.slice(-CONSOLE_LOG_CONFIG.maxLines) : next;
        });
      } else if (msg.type === "lines") {
        setLogs((prev) => {
          const next = [...prev, ...msg.lines];
          return next.length > CONSOLE_LOG_CONFIG.maxLines ? next.slice(-CONSOLE_LOG_CONFIG.maxLines) : next;
        });
      } else if (msg.type === "clear") {
        setLogs([]);
      }
    };

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const visibleLogs = levelFilter === "all" ? logs : logs.filter((line) => line.includes(`[${levelFilter}]`));

  return (
    <section className="overflow-hidden rounded-[10px] border border-border bg-surface" aria-label="Live application console">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-2 text-sm"><span className={`size-2 rounded-full ${connected ? "bg-success" : "bg-text-subtle"}`} aria-hidden="true" /><span className="text-text-main">{connected ? "Connected to log stream" : "Log stream disconnected"}</span></div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="console-level" className="text-xs text-text-muted">Level</label>
          <select id="console-level" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-main">
            <option value="all">All levels</option><option value="LOG">Log</option><option value="INFO">Info</option><option value="WARN">Warning</option><option value="ERROR">Error</option><option value="DEBUG">Debug</option>
          </select>
          <Button size="sm" variant="outline" icon="delete" onClick={handleClear}>Clear</Button>
        </div>
      </div>
      <div ref={logRef} className="h-[calc(100vh-260px)] min-h-64 overflow-auto bg-surface-2 p-4 font-mono text-xs leading-5" role="log" aria-live="polite">
        {visibleLogs.length === 0 ? (
          <p className="text-text-muted">{logs.length === 0 ? "No console logs yet. Application output will appear here." : `No ${levelFilter} entries in the current buffer.`}</p>
        ) : (
          <div className="space-y-0.5">
            {visibleLogs.map((line, i) => <div key={i} className="break-all">{colorLine(line)}</div>)}
          </div>
        )}
      </div>
    </section>
  );
}
