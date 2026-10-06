// Reviewed upstream snapshot. Setup does not execute the destructive fixer.
export const ANTIGRAVITY_FIXER = {
  repositoryUrl: "https://github.com/fulldiagnose/antigravity-fixer",
  cloneUrl: "https://github.com/fulldiagnose/antigravity-fixer.git",
  revision: "ea7dbd46d4139b1b84dfd5b68824b9a7ad410800",
  ageVerificationUrl: "https://myaccount.google.com/age-verification",
  permissionsUrl: "https://myaccount.google.com/connections",
  troubleshootingUrl: "https://github.com/google-gemini/gemini-cli/blob/main/docs/resources/troubleshooting.md",
};

export const ANTIGRAVITY_RECOVERY_EXAMPLES = [
  { id: "antigravity", label: "Antigravity: account not eligible", error: "Eligibility check failed: Your current account is not eligible for Antigravity." },
  { id: "gemini", label: "Gemini Code Assist: account not eligible", error: "There was an unexpected issue setting up your account. Your current account is not eligible for gemini code assist for individuals at this time." },
  { id: "validation", label: "403: VALIDATION_REQUIRED", error: "403 Forbidden — VALIDATION_REQUIRED" },
  { id: "token", label: "Expired or revoked login", error: "401 invalid_grant" },
];

export function getAntigravityFixerCommands() {
  return {
    setup: "miawrouter antigravity-fixer setup",
    clean: "miawrouter antigravity-fixer clean --confirm-clean",
    interactive: "miawrouter antigravity-fixer interactive --confirm-clean",
  };
}

export function classifyAntigravityRecoveryError(error) {
  const message = String(error || "");
  if (/VALIDATION_REQUIRED|verify.*(?:age|account)|age.verif/i.test(message)) {
    return {
      kind: "verification", title: "Complete Google's account verification", action: "verify",
      message: "Google is requesting additional account validation. Local cleanup cannot complete or bypass that check.",
      steps: ["Sign in to the same Google account and follow the verification instructions shown by Google. Check age verification if requested.", "After verification is approved, reconnect through MiawRouter OAuth and test the connection again.", "If validation is still required, use Google's support options. Do not repeatedly clear local data."],
    };
  }
  if (/not eligible|eligibility/i.test(message)) {
    const gemini = /gemini code assist/i.test(message);
    return {
      kind: "eligibility", service: gemini ? "gemini" : "antigravity", title: gemini ? "Check Gemini Code Assist eligibility" : "Check Antigravity eligibility", action: "eligibility",
      message: gemini ? "Google rejected setup for Gemini Code Assist for individuals. This can involve account requirements or service provisioning; it does not prove your local cache is broken." : "Google rejected this account's Antigravity eligibility check. The fixer can help with stale local sessions, but cannot grant eligibility or remove Google account restrictions.",
      steps: ["Confirm that you selected the intended Google account. Review the service's account and location requirements and any verification request.", "Reconnect through OAuth, then test the connection and retry onboarding once.", "If the same account remains ineligible, check Google's troubleshooting or contact support. Only consider local cleanup when you have evidence of a stale local login."],
    };
  }
  if (/token.*(?:expired|invalid|revoked)|invalid_grant|401/i.test(message)) {
    return { kind: "token", title: "Refresh the Google login", action: "reconnect", message: "The login token appears expired, invalid, or revoked. Start with OAuth reconnection; deleting IDE data is usually unnecessary.", steps: ["Reconnect the affected account through MiawRouter OAuth.", "Test the new connection, then retry your request.", "If the local Antigravity app still uses an old login, sign out and sign back in there before considering cleanup."] };
  }
  if (/403|access denied|forbidden|permission_denied/i.test(message)) {
    return { kind: "access", title: "Investigate the access denial", action: "check", message: "A generic 403 does not identify an eligibility or age-verification problem. Check the full error before choosing a fix.", steps: ["Test the connection and inspect the full Google error details.", "Check the selected account, permissions, and service access. Follow any explicit verification request.", "Use OAuth reconnection if the session is stale. Avoid deleting local data based only on the HTTP status."] };
  }
  return { kind: "unknown", title: "Identify the problem first", action: "check", message: "Use the connection check or select the error you see. Different errors require different recovery steps; cleanup is not a universal fix.", steps: ["Check the connection, network, proxy, and full error message.", "Select the matching error above to see the recommended recovery steps.", "If the connection works but a model fails, check that model's availability and quota."] };
}
