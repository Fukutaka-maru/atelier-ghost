import schemaSql from "../../db/migrations/0001_try_the_ghost.sql?raw";
import { getD1, readEnv } from "./env";
import type { Session } from "./session";

export const DAILY_TRY_LIMIT = 3;
const PENDING_TIMEOUT_MS = 15 * 60 * 1000;
const IP_WINDOW_MS = 60 * 60 * 1000;
const LINE_SESSION_FRIEND_TTL_MS = 24 * 60 * 60 * 1000;

export type UserRow = {
  id: string;
  email: string;
  line_user_id: string | null;
  line_friend_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WantSource = "product_page" | "post_try";

let schemaReady: Promise<void> | null = null;

/** migration SQL と同じ内容を CREATE ... IF NOT EXISTS で適用する（isolateごとに1回）。 */
export function ensureSchema() {
  schemaReady ??= (async () => {
    const db = getD1();
    const statements = schemaSql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    await db.batch(statements.map((statement) => db.prepare(statement)));
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

async function db() {
  await ensureSchema();
  return getD1();
}

const nowIso = () => new Date().toISOString();

/** 日本時間（Asia/Tokyo、UTC+9・夏時間なし）の日付 YYYY-MM-DD */
export function jstDate(date = new Date()) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export async function hashValue(value: string | null) {
  if (!value) return null;
  const salt = readEnv("HASH_SALT") ?? readEnv("SESSION_SECRET") ?? "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${value}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function clientIp(request: Request) {
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "local";
}

export async function upsertUserByEmail(email: string) {
  const database = await db();
  const now = nowIso();
  await database
    .prepare("INSERT INTO users (id, email, created_at, updated_at) VALUES (?1, ?2, ?3, ?3) ON CONFLICT (email) DO NOTHING")
    .bind(crypto.randomUUID(), email, now)
    .run();
  const user = await database.prepare("SELECT * FROM users WHERE email = ?1").bind(email).first<UserRow>();
  if (!user) throw new Error("USER_UPSERT_FAILED");
  return user;
}

export async function getUser(id: string) {
  return (await db()).prepare("SELECT * FROM users WHERE id = ?1").bind(id).first<UserRow>();
}

export type LineLinkResult = "linked" | "line_mismatch";

/** LINE Login 後に呼ぶ。1つのメールアドレスには1つのLINEアカウントだけを紐付ける。 */
export async function recordLineCheck(user: UserRow, lineUserId: string, friendFlag: boolean): Promise<LineLinkResult> {
  if (user.line_user_id && user.line_user_id !== lineUserId) return "line_mismatch";
  const database = await db();
  const now = nowIso();
  await database.batch([
    database
      .prepare(`UPDATE users SET line_user_id = ?2,
        line_friend_verified_at = CASE WHEN ?3 = 1 THEN ?4 ELSE line_friend_verified_at END,
        updated_at = ?4 WHERE id = ?1`)
      .bind(user.id, lineUserId, friendFlag ? 1 : 0, now),
    database
      .prepare(`INSERT INTO line_friend_checks (id, user_id, line_user_id, friend_flag, authenticated_at, friend_verified_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(crypto.randomUUID(), user.id, lineUserId, friendFlag ? 1 : 0, now, friendFlag ? now : null),
  ]);
  return "linked";
}

export type TryAccess = {
  registered: boolean;
  email: string | null;
  lineLinked: boolean;
  friendVerified: boolean;
  triedThisGhost: boolean;
  todayCount: number;
  dailyLimit: number;
};

/** この端末のセッションが、メール登録済み かつ この端末でLINE友だち確認済み かどうか */
export function isSessionFriendVerified(session: Session | null, user: UserRow | null) {
  return Boolean(
    session && user
    && session.uid === user.id
    && session.lid && user.line_user_id === session.lid
    && user.line_friend_verified_at
    && session.lv && Date.now() - session.lv < LINE_SESSION_FRIEND_TTL_MS,
  );
}

export async function usageFor(userId: string, lineUserId: string | null, ghostId: string) {
  const database = await db();
  const line = lineUserId ?? "";
  const [tried, today] = await Promise.all([
    database
      .prepare(`SELECT 1 AS hit FROM try_generations
        WHERE status <> 'failed' AND ghost_id = ?3 AND (user_id = ?1 OR line_user_id = ?2) LIMIT 1`)
      .bind(userId, line, ghostId)
      .first<{ hit: number }>(),
    database
      .prepare(`SELECT COUNT(*) AS count FROM try_generations
        WHERE status <> 'failed' AND jst_date = ?3 AND (user_id = ?1 OR line_user_id = ?2)`)
      .bind(userId, line, jstDate())
      .first<{ count: number }>(),
  ]);
  return { triedThisGhost: Boolean(tried), todayCount: Number(today?.count ?? 0) };
}

export async function getTryAccess(session: Session | null, ghostId: string): Promise<TryAccess> {
  const user = session ? await getUser(session.uid) : null;
  if (!user) {
    return { registered: false, email: null, lineLinked: false, friendVerified: false, triedThisGhost: false, todayCount: 0, dailyLimit: DAILY_TRY_LIMIT };
  }
  const usage = await usageFor(user.id, user.line_user_id, ghostId);
  return {
    registered: true,
    email: user.email,
    lineLinked: Boolean(session?.lid && session.lid === user.line_user_id),
    friendVerified: isSessionFriendVerified(session, user),
    ...usage,
    dailyLimit: DAILY_TRY_LIMIT,
  };
}

export type ReserveFailure = "ghost_used" | "daily_limit" | "ip_limit";

function ipHourlyLimit() {
  const configured = Number(readEnv("TRY_ON_IP_HOURLY_LIMIT"));
  return Number.isFinite(configured) && configured > 0 ? configured : 12;
}

/**
 * 生成APIを呼ぶ直前に、条件を満たす場合だけ pending 行を1つ挿入する。
 * 判定と挿入を1つのSQLで行うため、並列リクエストでも上限を超えない。
 */
export async function reserveGeneration(input: {
  user: UserRow;
  lineUserId: string;
  ghostId: string;
  colorName: string;
  ipHash: string | null;
  userAgentHash: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; reason: ReserveFailure }> {
  const database = await db();
  const now = new Date();
  await database
    .prepare("UPDATE try_generations SET status = 'failed' WHERE status = 'pending' AND generated_at < ?1")
    .bind(new Date(now.getTime() - PENDING_TIMEOUT_MS).toISOString())
    .run();

  const id = crypto.randomUUID();
  const today = jstDate(now);
  const ipSince = new Date(now.getTime() - IP_WINDOW_MS).toISOString();
  let changes = 0;
  try {
    const result = await database
      .prepare(`INSERT INTO try_generations
          (id, user_id, line_user_id, ghost_id, color_name, status, jst_date, generated_at, ip_hash, user_agent_hash)
        SELECT ?1, ?2, ?3, ?4, ?5, 'pending', ?6, ?7, ?8, ?9
        WHERE NOT EXISTS (
            SELECT 1 FROM try_generations
            WHERE status <> 'failed' AND ghost_id = ?4 AND (user_id = ?2 OR line_user_id = ?3))
          AND (SELECT COUNT(*) FROM try_generations
            WHERE status <> 'failed' AND jst_date = ?6 AND (user_id = ?2 OR line_user_id = ?3)) < ?10
          AND (?8 IS NULL OR (SELECT COUNT(*) FROM try_generations
            WHERE ip_hash = ?8 AND generated_at > ?11) < ?12)`)
      .bind(
        id, input.user.id, input.lineUserId, input.ghostId, input.colorName, today, now.toISOString(),
        input.ipHash, input.userAgentHash, DAILY_TRY_LIMIT, ipSince, ipHourlyLimit(),
      )
      .run();
    changes = result.meta.changes;
  } catch (error) {
    if (!String(error).includes("UNIQUE")) throw error;
  }
  if (changes === 1) return { ok: true, id };

  const usage = await usageFor(input.user.id, input.lineUserId, input.ghostId);
  if (usage.triedThisGhost) return { ok: false, reason: "ghost_used" };
  if (usage.todayCount >= DAILY_TRY_LIMIT) return { ok: false, reason: "daily_limit" };
  return { ok: false, reason: "ip_limit" };
}

export async function finishGeneration(id: string, status: "succeeded" | "failed") {
  await (await db()).prepare("UPDATE try_generations SET status = ?2 WHERE id = ?1").bind(id, status).run();
}

export async function hasSucceededGeneration(userId: string, ghostId: string) {
  const row = await (await db())
    .prepare("SELECT 1 AS hit FROM try_generations WHERE user_id = ?1 AND ghost_id = ?2 AND status = 'succeeded' LIMIT 1")
    .bind(userId, ghostId)
    .first<{ hit: number }>();
  return Boolean(row);
}

export async function recordWant(userId: string, ghostId: string, source: WantSource, colorName: string | null) {
  await (await db())
    .prepare(`INSERT INTO wants (id, user_id, ghost_id, source, color_name, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT (user_id, ghost_id, source) DO NOTHING`)
    .bind(crypto.randomUUID(), userId, ghostId, source, colorName, nowIso())
    .run();
}
