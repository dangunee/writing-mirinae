# writing.mirinae.jp

ミリネ韓国語教室の 한국어 작문(作文)トレーニング用ウェブアプリです。

## 機能

- **과제 리스트**: 週ごとの課題一覧、제출・첨삭 상태表示
- **과제 제출**: 学生が課題を提出（スレッド形式）
- **첨삭**: 講師がテキストエディタで添削・保存
- **학생 보기**: 学生が添削結果を確認

## 開発

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
```

## デプロイ (writing.mirinae.jp)

### Vercel でのデプロイ例

```bash
npm run build
vercel --prod
```

Vercel のプロジェクト設定で `writing.mirinae.jp` をカスタムドメインとして追加してください。

DNS 設定:
- `writing` を CNAME で `cname.vercel-dns.com` に設定
- または A レコードで Vercel の IP を指定

## データ保存

現在は localStorage を使用しています。本番運用では Firebase、Supabase などへの移行を検討してください。
