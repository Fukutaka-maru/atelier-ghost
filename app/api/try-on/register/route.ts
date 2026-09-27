import { json, jsonError } from "../../../../lib/try-the-ghost/http";
import { readSession, sessionCookie, sessionSecret } from "../../../../lib/try-the-ghost/session";
import { normalizeEmail, upsertUserByEmail } from "../../../../lib/try-the-ghost/store";

/** TRY THE GHOST のメールアドレス登録。同じメールアドレスは同じユーザーとして扱う。 */
export async function POST(request: Request) {
  if (!sessionSecret()) return jsonError("TRY THE GHOSTは現在準備中です。", 503, "TRY_NOT_CONFIGURED");
  const body = await request.json().catch(() => null) as { email?: unknown } | null;
  const email = normalizeEmail(body?.email);
  if (!email) return jsonError("メールアドレスを正しく入力してください。", 400, "INVALID_EMAIL");

  try {
    const user = await upsertUserByEmail(email);
    const current = await readSession(request);
    // 同じユーザーのままなら、この端末のLINE確認状態を引き継ぐ
    const keepLine = current?.uid === user.id ? { lid: current.lid, lv: current.lv } : {};
    return json({ ok: true, email: user.email }, { cookies: [await sessionCookie(request, { uid: user.id, ...keepLine })] });
  } catch (error) {
    console.error("ATELIER_GHOST_TRY_REGISTER_FAILED", error);
    return jsonError("メールアドレスを登録できませんでした。時間を置いてお試しください。", 500, "REGISTER_FAILED");
  }
}
