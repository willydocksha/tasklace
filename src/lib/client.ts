"use client";

export async function api<T = unknown>(path: string, method = "GET", data?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: data ? { "content-type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith("/api/auth")) window.location.href = "/login";
  if (!res.ok) throw new Error(json.error || "Request gagal");
  return json as T;
}
