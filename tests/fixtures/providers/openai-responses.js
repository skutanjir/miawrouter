export const mockOpenAIChatCompletion = (content = "Hello world", extra = {}) => ({
  id: "chatcmpl-mock-12345",
  object: "chat.completion",
  created: 1700000000,
  model: "gpt-mock",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content,
        ...extra.message,
      },
      finish_reason: extra.finish_reason || "stop",
    },
  ],
  usage: extra.usage || {
    prompt_tokens: 15,
    completion_tokens: 8,
    total_tokens: 23,
  },
});

export const mockOpenAIChatChunks = (tokens = ["Hello", " world"], extra = {}) => {
  const id = "chatcmpl-chunk-12345";
  const chunks = [];

  // First chunk with role
  chunks.push({
    id,
    object: "chat.completion.chunk",
    created: 1700000000,
    model: "gpt-mock",
    choices: [
      {
        index: 0,
        delta: { role: "assistant", content: "" },
        finish_reason: null,
      },
    ],
  });

  // Content chunks
  for (const token of tokens) {
    chunks.push({
      id,
      object: "chat.completion.chunk",
      created: 1700000000,
      model: "gpt-mock",
      choices: [
        {
          index: 0,
          delta: { content: token },
          finish_reason: null,
        },
      ],
    });
  }

  // Final stop chunk
  chunks.push({
    id,
    object: "chat.completion.chunk",
    created: 1700000000,
    model: "gpt-mock",
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: extra.finish_reason || "stop",
      },
    ],
    ...(extra.usage ? { usage: extra.usage } : {}),
  });

  return chunks;
};

export const mockOpenAIToolCallCompletion = ({ id = "call_abc123", name = "get_weather", args = '{"city":"Tokyo"}' } = {}) => ({
  id: "chatcmpl-mock-tools-123",
  object: "chat.completion",
  created: 1700000000,
  model: "gpt-mock",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id,
            type: "function",
            function: {
              name,
              arguments: args,
            },
          },
        ],
      },
      finish_reason: "tool_calls",
    },
  ],
  usage: {
    prompt_tokens: 25,
    completion_tokens: 12,
    total_tokens: 37,
  },
});

export const mockOpenAIReasoningCompletion = ({ thinking = "Let me think...", content = "Result" } = {}) => ({
  id: "chatcmpl-mock-reasoning-123",
  object: "chat.completion",
  created: 1700000000,
  model: "gpt-mock",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content,
        reasoning_content: thinking,
      },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 20,
    completion_tokens: 25,
    total_tokens: 45,
    completion_tokens_details: {
      reasoning_tokens: 15,
    },
  },
});
