import { PersistedSessionSchema } from "@/domain/sessionSchema";
import type { PersistedSession } from "@/domain/sessionSchema";

export const SESSION_STORAGE_KEY = "connected-decisions:v1:session";

export function saveSession(session: PersistedSession): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function loadSession(): PersistedSession | null {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (raw === null) {
    return null;
  }
  try {
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
  localStorage.removeItem(SESSION_STORAGE_KEY);
}