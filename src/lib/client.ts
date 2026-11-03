"use client";

// error from the api, keeping the status and the json body
export class ApiError extends Error {
  constructor(message: string, public status: number, public data: Record<string, unknown>) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, method = "GET", data?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: data ? { "content-type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith("/api/auth")) window.location.href = "/login";
  if (!res.ok) throw new ApiError(json.error || "Request gagal", res.status, json);
  return json as T;
}
