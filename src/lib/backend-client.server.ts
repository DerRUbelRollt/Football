import { HttpError } from "@/lib/api-helpers.server";

const DEFAULT_BACKEND_URLS = [
  "http://127.0.0.1:5000",
  "http://localhost:5000",
  "http://localhost:5001",
  "http://localhost:5002",
  "http://localhost:5003",
];

function getBackendBaseUrls(): string[] {
  const configured = [process.env.BACKEND_URL, process.env.VITE_BACKEND_URL]
    .filter((value): value is string => Boolean(value && value.trim()));

  return Array.from(new Set([...configured, ...DEFAULT_BACKEND_URLS]));
}

function buildUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export async function callBackend<T = unknown>(path: string, options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
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

      if (!response.ok) {
        const message = typeof parsed === "object" && parsed !== null && "error" in parsed && typeof (parsed as { error?: unknown }).error === "string"
          ? (parsed as { error: string }).error
          : `Backend request failed with ${response.status}`;
        // Das Backend hat geantwortet: Status durchreichen statt weitere URLs zu probieren.
        throw new HttpError(message, response.status);
      }

      return parsed as T;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Backend unavailable");
}
