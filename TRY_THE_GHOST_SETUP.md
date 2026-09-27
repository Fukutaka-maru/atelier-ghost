# TRY THE GHOST｜実装報告・セットアップ手順

最終更新: 2026-09-27
対象URL（仮ドメイン）: <https://site-creator-vinext-starter.takashi3241fuku.workers.dev/>
公式LINE: <https://line.me/R/ti/p/@060emkyc>

---

## 1. 追加した機能

| 機能 | 内容 | 主なファイル |
| --- | --- | --- |
| メールアドレス登録の必須化 | TRY THE GHOSTを開くと、最初にメールアドレスを入力する。前後の空白を除去して小文字化してから保存。同じメールアドレスではユーザーを重複作成しない | `app/api/try-on/register/route.ts` |
| LINE友だち追加の必須化 | LINE Login（`bot_prompt=aggressive` で友だち追加画面を表示）→ サーバー側で `friendship/v1/status` の `friendFlag` を確認。`true` の場合だけ写真アップロードを解放 | `app/api/line/login`, `app/api/line/callback`, `lib/try-the-ghost/line.ts` |
| 生成回数の制限 | 各GHOSTはメールアドレスごと・LINE user IDごとに1回まで。1日3回まで（日本時間で判定）。同じIPからの過剰な生成にも上限あり | `lib/try-the-ghost/store.ts` |
| 生成直前のサーバー側チェック | 画像生成APIを呼ぶ前に、ユーザー・メール・LINE紐付け・友だち確認・GHOSTの利用履歴・本日の回数・IP上限をすべて確認する | `app/api/try-on/route.ts` |
| 画像を保存しない | 写真と生成画像はレスポンスとして返すだけ。DB・R2・ファイルには保存しない。画面を閉じるとブラウザ上のデータを破棄する | `app/api/try-on/route.ts`, `VirtualTryOn.tsx` |
| 生成後のUI | I WANT THIS / SAVE IMAGE / SHARE。SHAREに対応していないブラウザでは代わりの案内を表示。「生成画像はこの画面を閉じると再表示できません…」を表示。生成後に閉じるときは確認ダイアログを出す | `app/ghosts/[slug]/VirtualTryOn.tsx` |
| I WANT THISの保存 | 商品ページから押したものは `product_page`、試着後に押したものは `post_try` としてDBに保存し、別々に集計できる | `app/api/wants/route.ts`, `ProductInterest.tsx` |
| 返品無料※・購入時の安心情報 | 購入可能な商品（`availability: "available"`）にだけ、返品無料※・条件の要約・「返品条件を見る」モーダル・配送予定・支払い方法・サイズを表示 | `ProductAssurance.tsx`, `app/return-policy.ts` |

ユーザー向けの回数表示は「このGHOSTは、1回だけ試せます。」「1日に3つまでGHOSTを試せます。」だけにしています。

### TRY THE GHOSTの流れ

```text
オンライン試着する
 ↓ 01 メールアドレス入力（/api/try-on/register）
 ↓ 02 「LINEで友だち追加して続ける」→ LINE Login → 友だち追加画面
 ↓    /api/line/callback でサーバー側から friendFlag を確認
 ↓    friendFlag=true  → 「LINEの友だち追加を確認しました」
 ↓    friendFlag=false → 「LINEの友だち追加が確認できませんでした。友だち追加後、もう一度確認してください。」
 ↓ 03 写真を選ぶ／撮影（ここで初めて解放される）
 ↓ 04 確認 → 05 生成（/api/try-on：生成直前に全条件をサーバーで再確認）
 ↓ 06 結果：I WANT THIS / SAVE IMAGE / SHARE
```

### 本人確認の考え方

- **セッション**: 署名付きCookie `ag_session`（HttpOnly / SameSite=Lax / 30日）。中身は `users.id`、この端末でLINE Loginしたときの LINE user ID、友だち確認の日時だけです。LINEのアクセストークンはCookieにもDBにも保存しません。
- **1つのメールアドレスに紐付けられるLINEアカウントは1つ**です。すでに別のLINEアカウントと紐付いているメールアドレスでLINE Loginすると、`line_mismatch` として拒否します。
- **1つのLINEアカウントを複数のメールアドレスで使っても**、回数は `line_user_id` でも数えるので、メールアドレスを変えて制限を回避することはできません。
- **友だち確認の有効期限**: LINE Loginで友だちを確認してから24時間です。過ぎた場合は、もう一度LINEで確認します。`LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` を設定すると、生成の直前にMessaging APIで「今も友だちか（ブロックしていないか）」も確認します（推奨）。
- **新しい端末**では、メールアドレスが登録済みでも、その端末でLINE Loginするまで生成できません。

### 回数の判定

- `try_generations` に `pending → succeeded / failed` の状態を持たせています。
- 判定と記録は **1つのSQL（条件付きINSERT）** でまとめて行います。並列にリクエストが来ても、上限を超えて生成APIが呼ばれることはありません。
- 生成に失敗した場合（OpenAIのエラーなど）は `failed` にして回数に数えず、同じGHOSTをもう一度試せます。15分以上 `pending` のままの行は `failed` として扱います。
- IPの上限は、失敗した試行も含めて「1時間に12回」です（`TRY_ON_IP_HOURLY_LIMIT` で変更可）。IPはソルト付きSHA-256でハッシュ化して保存します。スマホ回線では多くの人が同じIPを共有するため、厳しすぎない値にしています。

---

## 2. 追加したDBテーブル

Cloudflare D1: `atelier-ghost-db`（ID `0574906f-fdf2-41ae-b159-b83194e8a1bc`、binding `DB`）

| テーブル | 主なカラム | 用途 |
| --- | --- | --- |
| `users` | id, email (UNIQUE), line_user_id, line_friend_verified_at, created_at, updated_at | ユーザー |
| `try_generations` | id, user_id, line_user_id, ghost_id, color_name, status, jst_date, generated_at, ip_hash, user_agent_hash | 生成履歴（画像は保存しない） |
| `wants` | id, user_id, ghost_id, source (`product_page` / `post_try`), color_name, created_at | I WANT THIS。同じユーザー・GHOST・sourceの組み合わせは1件だけ |
| `line_friend_checks` | id, user_id, line_user_id, friend_flag, authenticated_at, friend_verified_at | LINE認証の日時と、友だち確認に成功した日時 |

日時はすべてUTCのISO 8601形式です。`jst_date` は日本時間の日付で、1日3回の判定に使います。

## 3. DB migration SQL

[`db/migrations/0001_try_the_ghost.sql`](./db/migrations/0001_try_the_ghost.sql)

- 本番のD1にはすでに適用済みです（2026-09-27）。
- 今後マイグレーションを追加したときは、次のコマンドで適用します。

  ```bash
  npm run db:migrate:remote
  ```

- アプリは起動時に同じSQL（`CREATE ... IF NOT EXISTS`）を実行するので、ローカル開発ではマイグレーションを手動で当てる必要はありません。

---

## 4. 追加した環境変数 / Secrets

**本番ではすべて Cloudflare Secrets として設定します。** `npm run deploy` は `vars: {}` の設定で上書きデプロイするため、ダッシュボードで設定した通常の「変数」は消えてしまいます。Secretsであればデプロイ後も残ります。

| 名前 | 必須 | 内容 |
| --- | --- | --- |
| `SESSION_SECRET` | 必須 | セッションCookieの署名鍵。`openssl rand -hex 32` で生成 |
| `HASH_SALT` | 必須 | IP / User-Agent をハッシュ化するときのソルト。`openssl rand -hex 32` で生成 |
| `LINE_LOGIN_CHANNEL_ID` | 必須 | LINE Loginチャネルの Channel ID |
| `LINE_LOGIN_CHANNEL_SECRET` | 必須 | LINE Loginチャネルの Channel secret |
| `APP_ORIGIN` | 推奨 | 公開URLのorigin。例 `https://site-creator-vinext-starter.takashi3241fuku.workers.dev`（末尾の `/` は不要）。未設定ならアクセス中のURLから自動で決める |
| `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` | 任意（推奨） | 公式LINEの Messaging API チャネルアクセストークン（長期）。生成直前に友だち状態を再確認する |
| `TRY_ON_IP_HOURLY_LIMIT` | 任意 | 同じIPからの1時間あたりの生成試行上限（既定 12） |
| `OPENAI_API_KEY` | 既存 | 設定済み |

ローカル開発では `.env.local` に書きます。`LINE_LOGIN_MOCK=true` / `TRY_ON_MOCK_IMAGE=true` は **localhostからのアクセスでだけ有効** で、本番に設定しても無視されます。

---

## 5. LINE Developers側で手動設定が必要な項目

1. **公式LINEをプロバイダーに所属させる**（まだの場合）
   LINE Official Account Manager → 設定 → Messaging API →「Messaging APIを利用する」→ プロバイダーを選ぶか作成する（例: `ATELIER GHOST`）。
2. **LINE Loginチャネルを作成する**
   [LINE Developers](https://developers.line.biz/console/) → 1. と**同じプロバイダー**で「新規チャネル作成」→「LINEログイン」。アプリタイプは「ウェブアプリ」にします。
   ※ LINE Login の user ID と公式LINE側の user ID が一致するのは、同じプロバイダーに属している場合だけです。
3. **コールバックURLを登録する**（LINEログイン設定タブ）

   ```text
   https://site-creator-vinext-starter.takashi3241fuku.workers.dev/api/line/callback
   ```

4. **公式LINEをリンクする**
   チャネル基本設定 →「リンクされたLINE公式アカウント」で `@060emkyc` を選びます。これを設定しないと、友だち追加画面の表示も `friendFlag` の取得もできません。
5. **チャネルを公開する**
   チャネルのステータスを「開発中」から「公開済み」にします。開発中のままだと、チャネルの権限を持つ人しかログインできません。
6. **Channel ID と Channel secret を控える**（基本設定タブ）→ 4. のSecretsに設定します。
7. （任意・推奨）**Messaging APIチャネル**（1. で作られたもの）→「Messaging API設定」→ チャネルアクセストークン（長期）を発行し、`LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` に設定します。

必要なスコープは `profile` だけです（メールアドレス取得の申請は不要）。

## 6. LINE公式アカウント側で必要な設定

- Messaging APIを有効にして、プロバイダーに所属させる（5-1）。
- 「友だち追加時あいさつ」は任意です。TRY THE GHOSTから友だち追加した人に向けた文面にしておくと自然です。
- 公式LINEで**ブロック**されると友だちではなくなるため、次にLINEで確認したとき（または `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` の設定時は生成の直前）に生成できなくなります。

## 7. Cloudflare側で必要な設定

- **D1**: `atelier-ghost-db` を作成し、マイグレーションも適用済みです。Workerとの接続（binding `DB`）は `vite.config.ts` で行っていて、`npm run deploy` のときに自動で紐付きます。
- **Secrets**: 4. の値を設定します（プロジェクトのフォルダで実行）。

  ```bash
  npx wrangler secret put SESSION_SECRET --name site-creator-vinext-starter
  npx wrangler secret put HASH_SALT --name site-creator-vinext-starter
  npx wrangler secret put LINE_LOGIN_CHANNEL_ID --name site-creator-vinext-starter
  npx wrangler secret put LINE_LOGIN_CHANNEL_SECRET --name site-creator-vinext-starter
  npx wrangler secret put APP_ORIGIN --name site-creator-vinext-starter
  ```

- **デプロイ**: `npm run deploy`（ビルドしてから `wrangler deploy` を実行します）。
- （推奨）**WAFのレート制限ルール**: Cloudflareダッシュボード → Security → WAF → Rate limiting rules で、`/api/try-on` へのPOSTを「同じIPから10分に10回まで」などに制限します。アプリ側のIP上限に加えた二重の防御になります。※ workers.dev ではWAFを使えないため、独自ドメインに移行してから設定します。

## 8. 現在の仮ドメインでの設定方法

1. 5. のLINE Developers設定を行い、コールバックURLに仮ドメインの `/api/line/callback` を登録する。
2. 7. のSecretsを設定する（`APP_ORIGIN=https://site-creator-vinext-starter.takashi3241fuku.workers.dev`）。
3. `npm run deploy` を実行する。

## 9. 将来独自ドメインへ変更するときに変更する箇所

| 箇所 | 変更内容 |
| --- | --- |
| Cloudflare Workers | Worker → Settings → Domains & Routes で独自ドメインを追加 |
| Secret `APP_ORIGIN` | `https://<独自ドメイン>` に変更 |
| LINE Developers | LINE Loginチャネルのコールバック URL に `https://<独自ドメイン>/api/line/callback` を追加（移行期間中は、仮ドメインのURLも残しておいてよい） |
| D1 | **変更不要**。同じ `atelier-ghost-db` をそのまま使い続けます |
| コード | 変更不要（ドメインは直書きしていません） |

※ Cookieはドメインごとに保存されるため、独自ドメインに移行すると、ユーザーはもう一度メールアドレス入力とLINE確認を行います。DBのデータ（生成履歴・回数・WANT）はそのまま引き継がれます。

---

## 10. 動作確認手順

### ローカル（LINE・OpenAIを使わずに確認）

`.env.local` に `SESSION_SECRET` / `HASH_SALT` と、次のモックを設定して `npm run dev` を実行し、`http://localhost:5173/ghosts/ghost-001` を開きます。

```env
LINE_LOGIN_MOCK=true
TRY_ON_MOCK_IMAGE=true
```

LINEの画面に「LOCAL MOCK」ボタン（友だち／友だちではない）が表示されます。モックの生成結果は、参照画像がそのまま返ります。ローカルのDBは `.wrangler/state/v3/d1/` にあり、`sqlite3` で中身を確認できます。

### 本番（仮ドメイン）

1. 商品ページ →「オンライン試着する」→ メールアドレスを入力 →「LINEで友だち追加して続ける」。
2. LINEでログインして友だち追加 → 商品ページに戻り、「LINEの友だち追加を確認しました」と写真の選択画面が表示される。
3. 写真を選んで生成 → 結果画面に I WANT THIS / SAVE IMAGE / SHARE が表示される。

本番DBの中身は次のコマンドで確認できます。

```bash
npx wrangler d1 execute atelier-ghost-db --remote --config dist/server/wrangler.json --command "SELECT ..."
```

※ `dist/server/wrangler.json` は `npm run build` で作られます。

### メール必須が機能しているかの確認方法

- メールアドレスを入力するまで、LINEのボタンも写真の選択画面も表示されないこと。
- Cookieがない状態で `/api/try-on` に直接POSTすると `401 TRY_EMAIL_REQUIRED` が返ること。

  ```bash
  curl -X POST <URL>/api/try-on -F productSlug=ghost-001
  ```

- ` Test@Example.COM ` と入力すると、`users.email` に `test@example.com` として1件だけ保存されること。

### LINE友だち必須が機能しているかの確認方法

- メールアドレス登録後、LINE確認の前に `/api/try-on` へPOSTすると `403 TRY_LINE_REQUIRED` が返ること。
- 公式LINEを**ブロックした状態**でLINE Loginすると、「LINEの友だち追加が確認できませんでした…」と表示され、写真の選択に進めないこと（`line_friend_checks.friend_flag = 0` が記録される）。
- ブロックを解除して「もう一度確認する」を押すと、写真の選択画面に進めること。
- 別の端末で同じメールアドレスを入力しただけでは生成できず、LINE Loginが求められること。

### 各GHOST 1回制限の確認方法

- 同じGHOSTで一度生成すると、次に開いたとき「このGHOSTは、1回だけ試せます。」と表示されること。
- 直接POSTしても `409 TRY_GHOST_ALREADY_USED` が返り、OpenAIが呼ばれないこと。
- **別のメールアドレスで、同じLINEアカウントを使っても**、同じGHOSTは生成できないこと。

  ```sql
  SELECT u.email, t.ghost_id, t.status, t.jst_date FROM try_generations t JOIN users u ON u.id = t.user_id;
  ```

### 1日3回制限の確認方法

- 日本時間の同じ日に3件生成すると、4件目は「1日に3つまでGHOSTを試せます。」と表示され、`429 TRY_DAILY_LIMIT` が返ること。
- 現在GHOSTは3種類なので、本番で確かめるときは、テスト用ユーザーの `try_generations` に当日の `jst_date` の行を手動で追加して確認します（ローカルでは確認済み）。

### Post-try I WANT THIS保存の確認方法

- 生成後に I WANT THIS を押すと「REQUEST RECEIVED」になり、次の行が1件保存されること。

  ```sql
  SELECT ghost_id, source, color_name FROM wants WHERE source = 'post_try';
  ```

- 商品ページの I WANT THIS は `source = 'product_page'` で保存されること。
- 生成していないGHOSTに `post_try` をPOSTすると `403 POST_TRY_NOT_ALLOWED` が返ること。
- 集計の例:

  ```sql
  SELECT ghost_id, source, COUNT(*) FROM wants GROUP BY ghost_id, source;
  ```

### 画像が恒久保存されていないことの確認方法

- DBのテーブルに、画像やURLを入れるカラムが存在しないこと。

  ```sql
  PRAGMA table_info(try_generations);
  ```

- R2を使っていないこと（`.openai/hosting.json` の `r2: null`、`dist/server/wrangler.json` の `r2_buckets: []`）。
- `/api/try-on` のレスポンスに `Cache-Control: private, no-store` が付いていること。
- 生成結果の画面を閉じる → もう一度開くと、生成画像は表示されない（再表示の手段がない）こと。
- コード上でも、`app/api/try-on/route.ts` は生成画像をレスポンスとして返すだけで、どこにも書き込んでいません。

---

## 11. 既知の制限・今後の検討

- メールアドレスが本人のものかどうかの確認（確認メールの送信）は行っていません。まだLINEと紐付いていないメールアドレスは、他人が先に登録できてしまいます。LINEと紐付いた後は、別のLINEアカウントからは使えません。
- `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` を設定しない場合、LINE確認から24時間以内のブロックは生成直前には検出できません。
- 購入可能な商品はまだないため、返品無料※などの安心情報は現在どの商品にも表示されていません。表示するには、`app/products.ts` の商品に次を追加します（microCMSの場合は `availability` / `shipping` / `payment` / `sizeInfo` / `returnExclusions` フィールド）。

  ```ts
  availability: "available",
  purchaseInfo: {
    shipping: "ご注文から5〜7営業日で発送",
    payment: "クレジットカード / Apple Pay",
    returnExclusions: ["この商品固有の返品対象外条件"],
  },
  ```
