import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("TokenSaverWire and CacheWire Presentation & Parity Contracts", () => {
  const cacheWireSource = fs.readFileSync(
    path.resolve(__dirname, "../../src/app/(dashboard)/dashboard/components/CacheWire.js"),
    "utf-8"
  );
  const tokenSaverWireSource = fs.readFileSync(
    path.resolve(__dirname, "../../src/app/(dashboard)/dashboard/components/TokenSaverWire.js"),
    "utf-8"
  );

  it("verifies chassis padding, gap, and styling parity between CacheWire and TokenSaverWire", () => {
    // Both cards must use padding="sm" and flex-stretch height contract
    expect(cacheWireSource).toContain('padding="sm"');
    expect(tokenSaverWireSource).toContain('padding="sm"');
    expect(cacheWireSource).toContain('className="flex h-full flex-col self-stretch"');
    expect(tokenSaverWireSource).toContain('className="flex h-full flex-col self-stretch"');

    // Both chassis containers must use identical padding and fill available card height
    expect(cacheWireSource).toContain('className="flex flex-col gap-2.5 rounded-[var(--radius-brand)] border p-3 bg-chassis"');
    expect(cacheWireSource).toContain('style={{ borderColor: "var(--color-rule)", flex: 1 }}');
    expect(tokenSaverWireSource).toContain('className="flex flex-col gap-3 rounded-[var(--radius-brand)] border p-3 bg-chassis"');
    expect(tokenSaverWireSource).toContain('style={{ borderColor: "var(--color-rule)", flex: 1 }}');

    // Both toolbars must allow flex wrapping without hard clipping
    expect(cacheWireSource).toContain("flex flex-wrap items-center justify-between gap-2");
    expect(tokenSaverWireSource).toContain("flex flex-wrap items-center justify-between gap-2");

    // Both status paragraphs must share border-t pt-2 and font-mono text-[11px]
    expect(cacheWireSource).toContain('className="cw-log-entry truncate border-t pt-2 font-mono text-[11px] text-muted"');
    expect(tokenSaverWireSource).toContain('className="tsw-log-entry truncate border-t pt-2 font-mono text-[11px]');
  });

  it("ensures TokenSaverWire and CacheWire are instrument panels with absence of node rails and arrow connectors", () => {
    // Neither CacheWire nor TokenSaverWire should contain legacy pipeline rail elements
    expect(cacheWireSource).not.toContain("RouteSeg");
    expect(cacheWireSource).not.toContain("EndpointNode");
    expect(cacheWireSource).not.toContain("cw-seg");
    expect(cacheWireSource).not.toContain("overflow-x-auto");
    expect(cacheWireSource).toContain('title="Cache activity"');

    // TokenSaverWire must not use connector segments or horizontal node funnel chips
    expect(tokenSaverWireSource).not.toContain("RouteSeg");
    expect(tokenSaverWireSource).not.toContain("<Seg");
    expect(tokenSaverWireSource).not.toContain("FUNNEL_W");
    expect(tokenSaverWireSource).not.toContain("StageNode");

    // Both wires feature instrument metric tiles and labels
    expect(cacheWireSource).toContain("Cache hits");
    expect(cacheWireSource).toContain("Dedup savings");
    expect(cacheWireSource).toContain('aria-label="Cache layers: L0 Prompt, L1 Exact, L2 Semantic, L3 Dedup"');

    expect(tokenSaverWireSource).toContain("Throughput");
    expect(tokenSaverWireSource).toContain("Provider");
    expect(tokenSaverWireSource).toContain("Latest Action");

    // TokenSaverWire features stepped compression stage rows with aria-label
    expect(tokenSaverWireSource).toContain("StageInstrumentRow");
    expect(tokenSaverWireSource).toContain('aria-label="Token-saver compression stages: Caveman, Ponytail, RTK, Headroom, PXPIPE"');
  });
});
