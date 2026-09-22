export const GROK_CLI_VERSION = "0.2.99";
export const GROK_CLI_MODEL = "grok-build";
export const GROK_CLI_BASE_URL = "https://cli-chat-proxy.grok.com/v1";
export const GROK_CLI_CLIENT_IDENTIFIER = "grok-shell";
export const GROK_CLI_USER_AGENT = `grok-shell/${GROK_CLI_VERSION} (linux; x86_64)`;

export function supportsGrokCliReasoningEffort(model) {
  const id = String(model || "");
  // grok-build / Composer reject reasoning.effort; 4.3/4.5/4.6/4.7 accept it.
  return /^grok-4\.(?:3|5|6|7)(?:$|-)/.test(id);
}

export function supportsGrokCliXhighEffort(model) {
  // xhigh is native on 4.6+ and 4.3; 4.5 treats it as high.
  return /^grok-4\.(?:3|6|7)(?:$|-)/.test(String(model || ""));
}
