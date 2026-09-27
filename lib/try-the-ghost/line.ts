import { appOrigin, readEnv } from "./env";

export const LINE_FRIEND_URL = "https://line.me/R/ti/p/@060emkyc";

export function lineLoginConfig(request: Request) {
  const channelId = readEnv("LINE_LOGIN_CHANNEL_ID");
  const channelSecret = readEnv("LINE_LOGIN_CHANNEL_SECRET");
  if (!channelId || !channelSecret) return null;
  return {
    channelId,
    channelSecret,
    redirectUri: `${appOrigin(request)}/api/line/callback`,
  };
}

export function lineAuthorizeUrl(config: NonNullable<ReturnType<typeof lineLoginConfig>>, state: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.channelId,
    redirect_uri: config.redirectUri,
    state,
    scope: "profile",
    // ログイン画面の後に、連携した公式LINEの友だち追加画面を必ず表示する
    bot_prompt: "aggressive",
  });
  return `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
}

type TokenResponse = { access_token?: string };
type ProfileResponse = { userId?: string };
type FriendshipResponse = { friendFlag?: boolean };

/**
 * 認可コードを交換し、LINE user ID と公式LINEとの友だち状態を取得する。
 * アクセストークンはこの関数内でのみ使い、保存しない。
 */
export async function fetchLineIdentity(config: NonNullable<ReturnType<typeof lineLoginConfig>>, code: string) {
  const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      client_id: config.channelId,
      client_secret: config.channelSecret,
    }),
  });
  const token = await tokenResponse.json() as TokenResponse;
  if (!tokenResponse.ok || !token.access_token) throw new Error(`LINE_TOKEN_FAILED_${tokenResponse.status}`);

  const headers = { Authorization: `Bearer ${token.access_token}` };
  const [profileResponse, friendshipResponse] = await Promise.all([
    fetch("https://api.line.me/v2/profile", { headers }),
    fetch("https://api.line.me/friendship/v1/status", { headers }),
  ]);
  const profile = await profileResponse.json() as ProfileResponse;
  const friendship = await friendshipResponse.json() as FriendshipResponse;
  if (!profileResponse.ok || !profile.userId) throw new Error(`LINE_PROFILE_FAILED_${profileResponse.status}`);
  if (!friendshipResponse.ok) throw new Error(`LINE_FRIENDSHIP_FAILED_${friendshipResponse.status}`);

  return { lineUserId: profile.userId, friendFlag: friendship.friendFlag === true };
}

/**
 * 生成直前の再確認（任意）。LINE_MESSAGING_CHANNEL_ACCESS_TOKEN を設定すると、
 * Messaging API で「今も友だちか（ブロックしていないか）」をサーバー側で確認する。
 * 未設定の場合は null を返し、LINE Login 時の友だち確認（24時間有効）で判定する。
 */
export async function isStillLineFriend(lineUserId: string): Promise<boolean | null> {
  const accessToken = readEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN");
  if (!accessToken) return null;
  const response = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(lineUserId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.ok) return true;
  if (response.status === 404) return false;
  throw new Error(`LINE_BOT_PROFILE_FAILED_${response.status}`);
}
