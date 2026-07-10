export interface SessionTokens {
  access_token: string;
  refresh_token: string;
}

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function setSessionTokens(tokens: SessionTokens) {
  if (!hasLocalStorage()) return;
  window.localStorage.setItem("auth_tokens", JSON.stringify(tokens));
}

export function getSessionTokens(): SessionTokens | null {
  if (!hasLocalStorage()) return null;
  const stored = window.localStorage.getItem("auth_tokens");
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function clearSessionTokens() {
  if (!hasLocalStorage()) return;
  window.localStorage.removeItem("auth_tokens");
}
