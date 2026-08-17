export default {
  id: "sambanova",
  alias: "samba",
  aliases: ["sambanova-ai"],
  uiAlias: "samba",
  hidden: true,
  display: {
    name: "SambaNova",
    icon: "memory",
    color: "#F97316",
    textIcon: "SN",
    website: "https://sambanova.ai",
    notice: {
      apiKeyUrl: "https://cloud.sambanova.ai/apis",
    },
  },
  category: "apikey",
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.sambanova.ai/v1/chat/completions",
    validateUrl: "https://api.sambanova.ai/v1/models",
  },
  models: [{
  id: "MiniMax-M2.7",
  name: "MiniMax M2.7",
  contextLength: 196608
}, {
  "id": "DeepSeek-V3.2",
  "name": "DeepSeek-V3.2"
}, {
  "id": "Llama-4-Maverick-17B-128E-Instruct",
  "name": "Llama-4-Maverick-17B-128E-Instruct"
}, {
  "id": "Meta-Llama-3.3-70B-Instruct",
  "name": "Meta-Llama-3.3-70B-Instruct"
}, {
  "id": "gpt-oss-120b",
  "name": "gpt-oss-120b"
}],
};
