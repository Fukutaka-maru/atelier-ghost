# AIオンライン試着の設定

## ローカルで接続する

1. OpenAI PlatformでAPIキーを作成します。
2. プロジェクト直下に `.env.local` を作り、次を設定します。

```env
OPENAI_API_KEY=sk-...
OPENAI_IMAGE_MODEL=gpt-image-2.5-sunburst
OPENAI_IMAGE_QUALITY=xhigh
OPENAI_IMAGE_SIZE=1024x1536
OPENAI_IMAGE_COMPRESSION=95
```

3. 開発サーバーを再起動します。

APIキーはブラウザへ渡さず、`/api/try-on` のサーバールートだけで使用します。キーが未設定の場合は、既存のレイアウトプレビューを表示します。

## 生成内容

1回の操作で、公式の正面テンプレートを参照した`TRY-ON`画像を1枚生成します。

生成後のATELIER GHOSTロゴはブラウザ上で合成するため、AIにロゴ文字を描かせません。

## 写真と保存

- 選択した写真はブラウザで最大1280pxのJPEGへ変換し、位置情報などの元ファイルのメタデータを外してから送信します。
- 写真は生成のためOpenAIへ送信します。
- この実装は写真や生成結果をデータベース、オブジェクトストレージ、ファイルシステムへ保存しません。
- ブラウザ上の写真と生成結果はモーダルを閉じると破棄します。

## 本番環境への引き継ぎ

- `OPENAI_API_KEY` はホスティング環境のSecretとして設定し、Gitへ追加しないでください。
- 現在はアプリ内に簡易レート制限があります。本番ではCloudflareなど配信基盤側でもレート制限を追加してください。
- 画像生成モデルの利用時にOpenAI Organization Verificationが求められる場合があります。
- 品質と費用を変える場合は `OPENAI_IMAGE_QUALITY` を調整します。現在は保存・シェア用途と応答の安定性を両立する `xhigh` です。
