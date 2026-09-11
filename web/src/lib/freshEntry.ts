import { clearSession, loadSession } from "@/lib/storage";
import type { PersistedSession } from "@/domain/sessionSchema";

/**
 * Consumes the public fresh-entry marker without carrying it into a later
 * refresh. The marker is intentionally URL-based so any public entry channel
 * can request a new training without introducing a server-side session.
 */
function consumeFreshEntry(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const url = new URL(window.location.href);
  if (url.searchParams.get("new") !== "1") {
    return false;
  }

  url.searchParams.delete("new");
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
  return true;
}

/**
 * Loads the current tab's session unless this visit was explicitly marked as
 * a fresh public entry. A fresh entry always hydrates as Intro, even if
 * clearing browser storage is unavailable or denied.
 */
export function initializeSessionForEntry(): PersistedSession | null {
  if (consumeFreshEntry()) {
    clearSession();
    return null;
  }

  return loadSession();
}
