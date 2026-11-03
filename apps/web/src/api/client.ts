export const API_BASE =
  (import.meta.env.VITE_COMMUNICATION_API_URL as string | undefined) || "";

export const WS_BASE =
  (import.meta.env.VITE_COMMUNICATION_WS_URL as string | undefined) || "";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  endpoint: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (options.body && typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const url = API_BASE ? `${API_BASE}${endpoint}` : endpoint;
  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errBody: { error?: { code?: string; message?: string } } = {};
    try {
      errBody = await res.json();
    } catch {
      // ignore non-json
    }
    throw new ApiError(
      res.status,
      errBody.error?.code ?? "API_ERROR",
      errBody.error?.message ?? `Request failed with status ${res.status}`,
    );
  }

  return (await res.json()) as T;
}
