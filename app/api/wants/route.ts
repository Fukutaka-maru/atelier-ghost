import { getProductBySlug } from "../../products";
import { json, jsonError } from "../../../lib/try-the-ghost/http";
import { readSession } from "../../../lib/try-the-ghost/session";
import { getUser, hasSucceededGeneration, normalizeEmail, recordWant, upsertUserByEmail } from "../../../lib/try-the-ghost/store";

/**
 * I WANT THIS の記録。
 * - source=product_page: 商品ページのI WANT THIS（メールアドレスで登録）
 * - source=post_try:     TRY THE GHOST後のI WANT THIS（試着済みセッションのユーザーで登録）
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    ghostId?: unknown;
    source?: unknown;
    email?: unknown;
    colorName?: unknown;
  } | null;
  const ghostId = typeof body?.ghostId === "string" ? body.ghostId : "";
  const colorName = typeof body?.colorName === "string" ? body.colorName.slice(0, 64) : null;
  if (!(await getProductBySlug(ghostId))) return jsonError("GHOSTが見つかりません。", 404, "GHOST_NOT_FOUND");

  try {
    if (body?.source === "post_try") {
      const session = await readSession(request);
      const user = session ? await getUser(session.uid) : null;
      if (!user || !(await hasSucceededGeneration(user.id, ghostId))) {
        return jsonError("試着後の登録を確認できませんでした。", 403, "POST_TRY_NOT_ALLOWED");
      }
      await recordWant(user.id, ghostId, "post_try", colorName);
      return json({ ok: true });
    }

    const email = normalizeEmail(body?.email);
    if (!email) return jsonError("メールアドレスを正しく入力してください。", 400, "INVALID_EMAIL");
    const user = await upsertUserByEmail(email);
    await recordWant(user.id, ghostId, "product_page", colorName);
    return json({ ok: true });
  } catch (error) {
    console.error("ATELIER_GHOST_WANT_FAILED", error);
    return jsonError("登録できませんでした。時間を置いてもう一度お試しください。", 500, "WANT_FAILED");
  }
}
