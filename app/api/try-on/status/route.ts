import { getProductBySlug } from "../../../products";
import { json, jsonError } from "../../../../lib/try-the-ghost/http";
import { lineLoginConfig } from "../../../../lib/try-the-ghost/line";
import { isMockEnabled } from "../../../../lib/try-the-ghost/env";
import { readSession, sessionSecret } from "../../../../lib/try-the-ghost/session";
import { getTryAccess } from "../../../../lib/try-the-ghost/store";

export async function GET(request: Request) {
  if (!sessionSecret()) return jsonError("TRY THE GHOSTは現在準備中です。", 503, "TRY_NOT_CONFIGURED");
  const ghostId = new URL(request.url).searchParams.get("ghost") ?? "";
  if (!(await getProductBySlug(ghostId))) return jsonError("GHOSTが見つかりません。", 404, "GHOST_NOT_FOUND");

  try {
    const access = await getTryAccess(await readSession(request), ghostId);
    return json({
      ...access,
      lineLoginReady: Boolean(lineLoginConfig(request)) || isMockEnabled(request, "LINE_LOGIN_MOCK"),
      lineMock: isMockEnabled(request, "LINE_LOGIN_MOCK"),
    });
  } catch (error) {
    console.error("ATELIER_GHOST_TRY_STATUS_FAILED", error);
    return jsonError("TRY THE GHOSTの状態を確認できませんでした。", 500, "TRY_STATUS_FAILED");
  }
}
