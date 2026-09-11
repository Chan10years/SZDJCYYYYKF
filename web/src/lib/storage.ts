import { PersistedSessionSchema } from "@/domain/sessionSchema";
import type { PersistedSession } from "@/domain/sessionSchema";

export const SESSION_STORAGE_KEY = "connected-decisions:v1:session";

export function saveSession(session: PersistedSession): void {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // sessionStorage 可能被 quota、隐私模式或安全策略拒绝；React 内存态继续工作。
  }
}

export function loadSession(): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    const result = PersistedSessionSchema.safeParse(parsed);
    if (!result.success) {
      return null;
    }
    return result.data;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // 清理失败不应阻断 reset；当前 React 会话仍可回到 intro。
  }
}
