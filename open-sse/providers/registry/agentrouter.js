// Intentionally not registered: agentrouter.org gates /v1 (models, chat, and
// messages) on an official-client check — every MiawRouter request returns
// 401 "unauthorized client detected" regardless of the API key, so it cannot
// be a usable transport. registry/index.js omits this module.
export default null;
