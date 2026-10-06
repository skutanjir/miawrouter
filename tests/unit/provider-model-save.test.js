import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ connection: vi.fn(), upsert: vi.fn() }));
vi.mock("@/models", () => ({ getProviderConnectionById: mocks.connection }));
vi.mock("@/lib/db/repos/aliasRepo.js", () => ({ upsertCustomModels: mocks.upsert }));
import { POST } from "../../src/app/api/providers/[id]/models/route.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.connection.mockResolvedValue({ id: "connection", provider: "commandcode", apiKey: "test" });
  mocks.upsert.mockResolvedValue({ added: 1, updated: 0 });
  global.fetch = vi.fn(async () => Response.json({ data: [{ id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5" }] }));
});
const request = (modelIds) => new Request("http://localhost/api/providers/connection/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modelIds }) });
const params = { params: Promise.resolve({ id: "connection" }) };

describe("saving discovered provider models", () => {
  it("validates against upstream and stores automatically resolved effort metadata", async () => {
    const response = await POST(request(["claude-sonnet-5-5"]), params);
    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith([expect.objectContaining({ id: "claude-sonnet-5-5", providerAlias: "cmc", source: "live", reasoningLevels: expect.arrayContaining(["high", "xhigh", "max"]) })]);
  });
  it("rejects a model that is no longer in the current catalog", async () => {
    expect((await POST(request(["invented"]), params)).status).toBe(409);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("does not save a static fallback as new upstream models", async () => {
    mocks.connection.mockResolvedValue({ id: "connection", provider: "antigravity" });
    expect((await POST(request(["example"]), params)).status).toBe(409);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("rejects empty selection and unknown connections", async () => {
    expect((await POST(request([]), params)).status).toBe(400);
    mocks.connection.mockResolvedValue(null);
    expect((await POST(request(["model"]), params)).status).toBe(404);
  });
});
