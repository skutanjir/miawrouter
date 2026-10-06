import { describe, expect, it } from "vitest";
import { ANTIGRAVITY_FIXER, ANTIGRAVITY_RECOVERY_EXAMPLES, classifyAntigravityRecoveryError, getAntigravityFixerCommands } from "../../src/shared/constants/antigravityRecovery.js";

describe("Antigravity Fixer recovery", () => {
  it.each([
    ["403 VALIDATION_REQUIRED", "verification"],
    ["Your current account is not eligible for Antigravity", "eligibility"],
    ["HTTP 403 Forbidden", "access"],
    ["Token invalid or revoked", "token"],
    ["invalid_grant", "token"],
    ["Proxy connection failed", "unknown"],
    [null, "unknown"],
  ])("classifies %s as %s", (error, kind) => {
    expect(classifyAntigravityRecoveryError(error).kind).toBe(kind);
  });

  it("distinguishes the user's three setup errors and prioritizes verification", () => {
    const [antigravity, gemini, validation] = ANTIGRAVITY_RECOVERY_EXAMPLES.map((item) => classifyAntigravityRecoveryError(item.error));
    expect(antigravity.service).toBe("antigravity");
    expect(gemini.service).toBe("gemini");
    expect(gemini.title).not.toBe(antigravity.title);
    expect(validation.action).toBe("verify");
    expect(classifyAntigravityRecoveryError("403 not eligible VALIDATION_REQUIRED").action).toBe("verify");
  });

  it("does not prescribe data deletion as the first action", () => {
    for (const { error } of ANTIGRAVITY_RECOVERY_EXAMPLES) {
      const plan = classifyAntigravityRecoveryError(error);
      expect(plan.action).not.toBe("clean");
      expect(plan.steps[0]).not.toMatch(/delete|clear|purge/i);
    }
    expect(classifyAntigravityRecoveryError("401 invalid_grant").action).toBe("reconnect");
    expect(classifyAntigravityRecoveryError("403 forbidden").action).toBe("check");
  });

  it("provides bundled CLI commands without needing Git or activating scripts", () => {
    const { setup, clean } = getAntigravityFixerCommands("windows");
    expect(setup).toBe("miawrouter antigravity-fixer setup");
    expect(ANTIGRAVITY_FIXER.revision).toMatch(/^[a-f0-9]{40}$/);
    expect(clean).toBe("miawrouter antigravity-fixer clean --confirm-clean");
    expect(setup).not.toContain("fix.py");
  });

  it("uses the same bundled commands on macOS and Linux", () => {
    const { setup, clean } = getAntigravityFixerCommands("unix");
    expect(setup).toBe("miawrouter antigravity-fixer setup");
    expect(clean).toBe("miawrouter antigravity-fixer clean --confirm-clean");
    expect(setup).not.toContain("fix.py");
  });
});
