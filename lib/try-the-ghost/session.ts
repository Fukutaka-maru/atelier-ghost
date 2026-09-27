import { readEnv } from "./env";

/**
 * 署名付きCookieによる軽量セッション。
 * - uid: メール登録したユーザーの users.id
 * - lid: この端末で LINE Login を完了した LINE user ID
 * - lv:  この端末で LINE 友だち確認が成功した日時（ms）
 * LINE のアクセストークン等はCookieにもDBにも保存しない。
 */
export type Session = {
  uid: string;
  lid?: string;
  lv?: number;
  exp: number;
};

export const SESSION_COOKIE = "ag_session";
export const LINE_STATE_COOKIE = "ag_line_state";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function sessionSecret() {
  return readEnv("SESSION_SECRET");
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function sign(payload: object) {
  const secret = sessionSecret();
  if (!secret) throw new Error("SESSION_SECRET_MISSING");
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(body));
  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function verify<T extends { exp: number }>(token: string | undefined): Promise<T | null> {
  const secret = sessionSecret();
  if (!token || !secret) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret), base64UrlDecode(signature), encoder.encode(body));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as T;
    return typeof payload.exp === "number" && payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

export function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

function cookieAttributes(request: Request, maxAgeSeconds: number) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export async function readSession(request: Request) {
  return verify<Session>(readCookie(request, SESSION_COOKIE));
}

export async function sessionCookie(request: Request, session: Omit<Session, "exp">) {
  const token = await sign({ ...session, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 });
  return `${SESSION_COOKIE}=${token}${cookieAttributes(request, SESSION_MAX_AGE_SECONDS)}`;
}

export type LineState = { state: string; uid: string; returnTo: string; exp: number };

export async function lineStateCookie(request: Request, value: Omit<LineState, "exp">) {
  const maxAge = 60 * 10;
  const token = await sign({ ...value, exp: Date.now() + maxAge * 1000 });
  return `${LINE_STATE_COOKIE}=${token}${cookieAttributes(request, maxAge)}`;
}

export async function readLineState(request: Request) {
  return verify<LineState>(readCookie(request, LINE_STATE_COOKIE));
}

export function clearCookie(request: Request, name: string) {
  return `${name}=${cookieAttributes(request, 0)}`;
}
