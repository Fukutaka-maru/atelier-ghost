import { isMockEnabled } from "../../../../lib/try-the-ghost/env";
import { redirect } from "../../../../lib/try-the-ghost/http";
import { fetchLineIdentity, lineLoginConfig } from "../../../../lib/try-the-ghost/line";
import { clearCookie, LINE_STATE_COOKIE, readLineState, readSession, sessionCookie } from "../../../../lib/try-the-ghost/session";
import { getUser, recordLineCheck } from "../../../../lib/try-the-ghost/store";

function back(returnTo: string, result: string, cookies: string[]) {
  const url = new URL(returnTo, "https://atelier.local");
  url.searchParams.set("tryon", result);
  return redirect(`${url.pathname}${url.search}`, cookies);
}

/** LINE Login の callback。サーバー側で友だち状態（friendFlag）を確認する。 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lineState = await readLineState(request);
  const clearState = clearCookie(request, LINE_STATE_COOKIE);
  const session = await readSession(request);
  const returnTo = lineState?.returnTo ?? "/";

  if (!lineState || lineState.state !== url.searchParams.get("state") || !session || session.uid !== lineState.uid) {
    return back(returnTo, "line_error", [clearState]);
  }
  const code = url.searchParams.get("code");
  if (!code) return back(returnTo, "line_cancelled", [clearState]);

  try {
    const user = await getUser(session.uid);
    if (!user) return back(returnTo, "email_required", [clearState]);

    let identity: { lineUserId: string; friendFlag: boolean };
    const mock = code.match(/^mock:(friend|not_friend):([\w-]+)$/);
    if (mock && isMockEnabled(request, "LINE_LOGIN_MOCK")) {
      identity = { lineUserId: `Umock_${mock[2]}`, friendFlag: mock[1] === "friend" };
    } else {
      const config = lineLoginConfig(request);
      if (!config) return back(returnTo, "line_unavailable", [clearState]);
      identity = await fetchLineIdentity(config, code);
    }

    const link = await recordLineCheck(user, identity.lineUserId, identity.friendFlag);
    if (link === "line_mismatch") return back(returnTo, "line_mismatch", [clearState]);

    const nextSession = await sessionCookie(request, {
      uid: user.id,
      lid: identity.lineUserId,
      lv: identity.friendFlag ? Date.now() : undefined,
    });
    return back(returnTo, identity.friendFlag ? "line_ok" : "line_not_friend", [clearState, nextSession]);
  } catch (error) {
    console.error("ATELIER_GHOST_LINE_CALLBACK_FAILED", error);
    return back(returnTo, "line_error", [clearState]);
  }
}
