/**
 * Client-side session management
 * Stores auth tokens in localStorage
 */

export interface SessionTokens {
  access_token: string;
  refresh_token: string;
}

export function setSessionTokens(tokens: SessionTokens) {
  localStorage.setItem("auth_tokens", JSON.stringify(tokens));
}

export function getSessionTokens(): SessionTokens | null {
  const stored = localStorage.getItem("auth_tokens");
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function clearSessionTokens() {
  localStorage.removeItem("auth_tokens");
}
