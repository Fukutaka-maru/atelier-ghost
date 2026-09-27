# ATELIER GHOST microCMS setup

無料運用で始めるための最小構成です。

## 1. APIを作る

microCMSで新しいAPIを作成します。

- API名: `GHOSTS`
- エンドポイント: `ghosts`
- APIの型: リスト形式

## 2. フィールドを作る

以下のフィールドIDで作ると、このサイトがそのまま読み込みます。

| フィールドID | 種類 | 内容 |
| --- | --- | --- |
| `slug` | テキストフィールド | URL用。例: `ghost-001` |
| `name` | テキストフィールド | 商品名。例: `CUT LENS` |
| `price` | テキストフィールド | 価格。例: `¥78,000 JPY` |
| `category` | セレクトフィールド | `glasses` / `belt` / `shoes` / `jacket` / `tops` / `bottoms` / `accessory` |
| `alt` | テキストフィールド | 画像の説明文 |
| `description` | テキストエリア | 商品詳細ページの説明 |
| `wornBy` | テキストフィールド | 着用者名。例: `KAHO` |
| `wearerQuote` | テキストエリア | 着用者コメント。例: `強さを見せなくても、強くいられる自分。` |
| `specs` | 繰り返しフィールド | サイズ、素材などの仕様 |
| `images` | 複数画像 | 色展開がない商品の画像 |
| `modelImages` | 複数画像 | MODELタブに表示する着用者ビジュアル |
| `colors` | 繰り返しフィールド | 色展開がある商品の色・画像 |
| `sortOrder` | 数字 | 表示順。小さい数字が先 |

`colors` の中身は以下にします。

| フィールドID | 種類 | 内容 |
| --- | --- | --- |
| `name` | テキストフィールド | 色名。例: `DEEP AQUA BLUE` |
| `swatch` | テキストフィールド | 色コード。例: `#3d6d8a` |
| `images` | 複数画像 | その色の画像 |

`specs` の中身は以下にします。

| フィールドID | 種類 | 内容 |
| --- | --- | --- |
| `label` | テキストフィールド | 例: `SIZE` / `MATERIAL` |
| `value` | テキストフィールド | 例: `S / M / L` |

## 3. APIキーを入れる

`.env.example` を参考にして `.env.local` を作ります。

```txt
MICROCMS_SERVICE_DOMAIN=あなたのサービスID
MICROCMS_API_KEY=あなたのAPIキー
MICROCMS_ENDPOINT=ghosts
```

`MICROCMS_SERVICE_DOMAIN` は `https://xxxxx.microcms.io` の `xxxxx` 部分です。

## 4. 更新の考え方

- microCMSの情報が未設定の間は、今までのローカル商品が表示されます。
- microCMSの情報を設定すると、商品一覧と商品詳細ページがCMSの内容に切り替わります。
- スマホからmicroCMS管理画面を開けば、商品追加、価格変更、画像差し替えができます。
