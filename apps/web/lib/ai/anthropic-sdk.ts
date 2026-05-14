import { createRequire } from "node:module";

const requireAnthropic = createRequire(import.meta.url);

export type AnthropicStreamEvent = {
  type: string;
  delta?: {
    type: string;
    text?: string;
  };
};

export type AnthropicMessageResponse = {
  content: Array<{
    type: string;
    text?: string;
  }>;
};

export type AnthropicMessageStream = AsyncIterable<AnthropicStreamEvent>;

export type AnthropicClient = {
  messages: {
    create(
      args: unknown,
    ): Promise<AnthropicMessageResponse | AnthropicMessageStream>;
  };
};

type AnthropicModule = {
  default?: new (options: { apiKey?: string }) => AnthropicClient;
};

export function createAnthropicClient(options: {
  apiKey?: string;
}): AnthropicClient {
  const anthropicModule = requireAnthropic(
    "@anthropic-ai/sdk",
  ) as AnthropicModule;
  const Anthropic = anthropicModule.default;
  if (!Anthropic) {
    throw new Error("Anthropic SDK default export is unavailable");
  }
  return new Anthropic(options);
}
