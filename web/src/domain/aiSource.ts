export type AiResponseSource = "live" | "fallback";

export function getAiSourceLabel(source: AiResponseSource): string {
  return source === "live" ? "在线 AI" : "程序化 fallback";
}
