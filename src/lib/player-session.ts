const KEY = "ftm.player_code";

export function getPlayerCode(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function setPlayerCode(code: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, code);
}

export function clearPlayerCode() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
