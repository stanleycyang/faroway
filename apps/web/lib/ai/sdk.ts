import { createRequire } from "node:module";

const requireAi = createRequire(import.meta.url);

export type AiGateway = (model: string) => unknown;
export type AiUsage = { totalTokens?: number };
export type GenerateObjectResult<T> = { object: T; usage?: AiUsage };
export type GenerateTextResult = { text: string; usage?: AiUsage };

type AiSdkModule = {
  generateObject: <T>(args: unknown) => Promise<GenerateObjectResult<T>>;
  generateText: (args: unknown) => Promise<GenerateTextResult>;
  streamText: (args: unknown) => unknown;
  gateway: AiGateway;
  createGateway: (options: { apiKey?: string }) => AiGateway;
  tool: <TDefinition extends object>(definition: TDefinition) => unknown;
  Output: {
    object: (config: { schema: unknown }) => unknown;
  };
  stepCountIs: (count: number) => unknown;
  ToolLoopAgent: new (config: unknown) => {
    generate(args: unknown): Promise<{ output?: unknown }>;
  };
};

function getAiSdk(): AiSdkModule {
  return requireAi("ai") as AiSdkModule;
}

export function boundedStagingArgs(args: unknown): unknown {
  if (process.env.VERCEL_ENV !== "preview") return args;
  const cap = Number(process.env.FAROWAY_STAGING_AI_MAX_OUTPUT_TOKENS);
  if (!Number.isInteger(cap) || cap < 100 || cap > 8000) return args;
  if (!args || typeof args !== "object") return args;
  const options = args as Record<string, unknown>;
  const requested = options.maxOutputTokens;
  return {
    ...options,
    maxOutputTokens:
      typeof requested === "number" ? Math.min(requested, cap) : cap,
    maxRetries: 0,
  };
}

export function generateObject<T>(
  args: unknown,
): Promise<GenerateObjectResult<T>> {
  return getAiSdk().generateObject<T>(boundedStagingArgs(args));
}

export function generateText(args: unknown): Promise<GenerateTextResult> {
  return getAiSdk().generateText(boundedStagingArgs(args));
}

export function streamText(args: unknown): unknown {
  return getAiSdk().streamText(args);
}

export const gateway: AiGateway = (model) => getAiSdk().gateway(model);

export function createGateway(options: { apiKey?: string }): AiGateway {
  return getAiSdk().createGateway(options);
}

export function tool<TDefinition extends object>(
  definition: TDefinition,
): unknown {
  return getAiSdk().tool(definition);
}

export const Output = {
  object(config: { schema: unknown }): unknown {
    return getAiSdk().Output.object(config);
  },
};

export function stepCountIs(count: number): unknown {
  return getAiSdk().stepCountIs(count);
}

export class ToolLoopAgent<TOutput = unknown> {
  private readonly agent: {
    generate(args: unknown): Promise<{ output?: unknown }>;
  };

  constructor(config: unknown) {
    const { ToolLoopAgent: RuntimeToolLoopAgent } = getAiSdk();
    this.agent = new RuntimeToolLoopAgent(config);
  }

  async generate(args: unknown): Promise<{ output?: TOutput }> {
    return (await this.agent.generate(args)) as { output?: TOutput };
  }
}
