import { env as cloudflareEnv } from "cloudflare:workers";

type D1Result<T> = { results: T[]; meta: { changes: number } };

export type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result<never>>;
};

export type D1Database = {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result<never>[]>;
};

const workerEnv = cloudflareEnv as Record<string, unknown>;

/** Secrets / Environment Variables（Cloudflare）と .env.local（ローカル）の両方から読む。 */
export function readEnv(name: string): string | undefined {
  const value = process.env[name] ?? workerEnv[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export function getD1(): D1Database {
  const db = workerEnv.DB as D1Database | undefined;
  if (!db) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  return db;
}

export function isLocalRequest(request: Request) {
  const { hostname } = new URL(request.url);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/**
 * ローカル動作確認用のモック。localhost からのリクエストでのみ有効になり、
 * 本番（workers.dev / 独自ドメイン）では環境変数を設定しても無視される。
 */
export function isMockEnabled(request: Request, name: "LINE_LOGIN_MOCK" | "TRY_ON_MOCK_IMAGE") {
  return isLocalRequest(request) && readEnv(name) === "true";
}

/**
 * 公開URLの origin。LINE Login の callback URL の組み立てに使う。
 * APP_ORIGIN を設定していればそれを使い、未設定ならリクエストの origin を使う。
 * 独自ドメインへ移行するときは APP_ORIGIN を変更する。
 */
export function appOrigin(request: Request) {
  return (readEnv("APP_ORIGIN") ?? new URL(request.url).origin).replace(/\/+$/, "");
}
