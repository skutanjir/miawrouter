import { describe, expect, it, vi } from "vitest";
import { handleComboChat } from "../../open-sse/services/combo.js";

describe("combo error fallback", () => {
  it("returns an invalid request without sending it to another model", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "invalid request" } }), { status: 400 }));
    const result = await handleComboChat({ body: {}, models: ["first/model", "second/model"], handleSingleModel: request, log: { info() {}, warn() {} } });
    expect(result.status).toBe(400);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("tries the next model when a provider is unavailable", async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 503 })).mockResolvedValueOnce(new Response("ok"));
    const result = await handleComboChat({ body: {}, models: ["first/model", "second/model"], handleSingleModel: request, log: { info() {}, warn() {} } });
    expect(await result.text()).toBe("ok");
    expect(request).toHaveBeenCalledTimes(2);
  });
});
