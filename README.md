# writing.mirinae.jp

ミリネ韓国語教室・作文トレーニング

## 開発

```bash
npm install
npm run dev
```

http://localhost:3000 で確認できます。

## ビルド・デプロイ

```bash
npm run build
npm start
```

## writing.mirinae.jp で公開するには

### Vercel の場合

1. [Vercel](https://vercel.com) にプロジェクトをインポート
2. **Settings** → **Domains** で `writing.mirinae.jp` を追加
3. DNS で `writing.mirinae.jp` を Vercel に向ける（CNAME または A レコード）

### その他のホスティング

- Netlify, Cloudflare Pages などでも同様にドメインを設定可能です。
