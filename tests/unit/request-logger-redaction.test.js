import { describe, expect, it } from "vitest";
import { maskSensitiveHeaders, maskSensitiveUrl } from "../../open-sse/utils/requestLogger.js";

describe("request log credential redaction", () => {
  it("redacts request and response credentials without exposing fragments", () => {
    const headers = new Headers({ authorization: "Bearer short", "x-goog-api-key": "abc", "set-cookie": "session=private", "content-type": "application/json" });
    expect(maskSensitiveHeaders(headers)).toEqual({ authorization: "[redacted]", "x-goog-api-key": "[redacted]", "set-cookie": "[redacted]", "content-type": "application/json" });
    expect(maskSensitiveHeaders([["Authorization", "Bearer short"]])).toEqual({ Authorization: "[redacted]" });
  });

  it("redacts credentials in absolute and relative URLs", () => {
    expect(maskSensitiveUrl("https://user:pass@example.com/v1?key=secret&model=test")).not.toMatch(/user|pass|secret/);
    expect(maskSensitiveUrl("/v1?api_key=secret&model=test")).toContain("model=test");
    expect(maskSensitiveUrl("/v1?api_key=secret&model=test")).not.toContain("secret");
    expect(maskSensitiveUrl("https://example.com/v1#access_token=secret")).not.toContain("secret");
  });
});
