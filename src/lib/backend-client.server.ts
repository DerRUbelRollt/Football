import { HttpError } from "@/lib/api-helpers.server";

const DEFAULT_BACKEND_URLS = [
  "http://192.168.178.37:5000",
  "http://127.0.0.1:5000",
  "http://localhost:5000",
  "http://localhost:5001",
  "http://localhost:5002",
  "http://localhost:5003",
];

function getBackendBaseUrls(): string[] {
  const configured = [process.env.BACKEND_URL, process.env.VITE_BACKEND_URL].filter(
    (value): value is string => Boolean(value && value.trim()),
  );

  return Array.from(new Set([...configured, ...DEFAULT_BACKEND_URLS]));
}

function buildUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export interface BackendResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
  /** Set-Cookie-Header des Backends, damit Routen sie an den Browser weiterreichen können. */
  setCookies: string[];
}

export async function callBackendRaw<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<BackendResult<T>> {
  const { method = "GET", body, headers = {} } = options;

  let lastError: unknown;
  for (const baseUrl of getBackendBaseUrls()) {
    try {
      const response = await fetch(buildUrl(baseUrl, path), {
        method,
        headers: {
          "content-type": "application/json",
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      const text = await response.text();
      let parsed: unknown = null;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
      }

      // Das Backend hat geantwortet (egal mit welchem Status): Ergebnis
      // zurückgeben statt weitere URLs zu probieren.
      return {
        ok: response.ok,
        status: response.status,
        data: parsed as T,
        setCookies: response.headers.getSetCookie(),
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Backend unavailable");
}

export function httpErrorFromBackend(result: BackendResult): HttpError {
  const parsed = result.data;
  const message =
    typeof parsed === "object" &&
    parsed !== null &&
    "error" in parsed &&
    typeof (parsed as { error?: unknown }).error === "string"
      ? (parsed as { error: string }).error
      : `Backend request failed with ${result.status}`;
  return new HttpError(message, result.status);
}

export async function callBackend<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const result = await callBackendRaw<T>(path, options);
  if (!result.ok) throw httpErrorFromBackend(result);
  return result.data;
}
