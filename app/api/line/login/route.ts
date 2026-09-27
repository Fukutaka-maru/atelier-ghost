import { isMockEnabled } from "../../../../lib/try-the-ghost/env";
import { redirect, safeReturnTo } from "../../../../lib/try-the-ghost/http";
import { lineAuthorizeUrl, lineLoginConfig } from "../../../../lib/try-the-ghost/line";
import { lineStateCookie, readSession } from "../../../../lib/try-the-ghost/session";

function withTryResult(returnTo: string, result: string) {
  const url = new URL(returnTo, "https://atelier.local");
  url.searchParams.set("tryon", result);
  return `${url.pathname}${url.search}`;
}

/** 「LINEで友だち追加して続ける」→ LINE Login へリダイレクトする */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const session = await readSession(request);
  if (!session) return redirect(withTryResult(returnTo, "email_required"));

  const state = crypto.randomUUID();
  const stateCookie = await lineStateCookie(request, { state, uid: session.uid, returnTo });

  if (isMockEnabled(request, "LINE_LOGIN_MOCK")) {
    const mock = url.searchParams.get("mock") === "not_friend" ? "not_friend" : "friend";
    const mockUser = (url.searchParams.get("mockUser") ?? "local").replace(/[^a-z0-9_-]/gi, "").slice(0, 32) || "local";
    return redirect(`/api/line/callback?code=mock:${mock}:${mockUser}&state=${state}`, [stateCookie]);
  }

  const config = lineLoginConfig(request);
  if (!config) return redirect(withTryResult(returnTo, "line_unavailable"));
  return redirect(lineAuthorizeUrl(config, state), [stateCookie]);
}
