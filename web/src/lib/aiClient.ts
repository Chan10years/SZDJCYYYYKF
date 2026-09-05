/**
 * 通用 OpenAI 兼容 Chat Completions 客户端。
 * 仅允许在服务端调用（读取 AI_* 环境变量）。
 */

export type ChatMessage = { role: "system" | "user"; content: string };

export type ChatCompletionArgs = {
  messages: ChatMessage[];
  timeoutMs: number;
  maxTokens: number;
};

export async function requestChatCompletion(
  args: ChatCompletionArgs,
): Promise<string> {
  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (!baseUrl || !apiKey || !model) {
    throw new Error("AI credentials are not configured");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: args.messages,
        temperature: 0.2,
        max_tokens: args.maxTokens,
        thinking: {
          type: "disabled",
        },
      }),
      signal: controller.signal,
      // 路由处理程序内默认动态；明确关闭 fetch 缓存以免复用 LLM 响应
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`AI request failed with status ${response.status}`);
    }

    // timeout 覆盖完整响应读取过程：body 卡住时 abort 同样生效，触发调用方 fallback。
    const data: unknown = await response.json();
    const content = extractContent(data);
    if (content === null) {
      throw new Error("AI response missing content");
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

function extractContent(data: unknown): string | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }
  const first = choices[0];
  if (typeof first !== "object" || first === null) {
    return null;
  }
  const maybe = (first as { message?: { content?: unknown } }).message?.content;
  return typeof maybe === "string" ? maybe : null;
}
