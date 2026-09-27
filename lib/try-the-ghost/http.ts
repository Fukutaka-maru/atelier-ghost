export function noStoreHeaders(extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set("Cache-Control", "private, no-store, no-cache, max-age=0");
  headers.set("Pragma", "no-cache");
  return headers;
}

export function json(body: unknown, init: { status?: number; cookies?: string[] } = {}) {
  const headers = noStoreHeaders({ "Content-Type": "application/json; charset=utf-8" });
  for (const cookie of init.cookies ?? []) headers.append("Set-Cookie", cookie);
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

export function jsonError(message: string, status: number, code: string) {
  return json({ error: message, code }, { status });
}

export function redirect(location: string, cookies: string[] = []) {
  const headers = noStoreHeaders({ Location: location });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

/** 同一オリジン内の相対パスだけを許可する */
export function safeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}
