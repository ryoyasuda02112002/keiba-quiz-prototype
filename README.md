# 競馬クイズ プロトタイプ

GitHub Pagesで身内共有するための、依存なしの静的Webアプリです。問題は、2026年に実施済みのJRA平地G1（2月〜6月）で3着内に入った実在馬31頭を対象にした検証用データです。

## ローカル確認

```powershell
python -m http.server 4173
```

ブラウザで `http://localhost:4173` を開きます。データ検証とテストは次で実行します。

```powershell
npm run check
```

## 実在データへ差し替える前に

- `data/collection.2026.jra-g1.json` は参照した公開結果・戦績の事実情報を独自整理した検証用データです
- 更新時は `node scripts/build-verified-2026-data.js` のシードを置き換え、`npm run check` を実行する
- `sourceNote` と `verifiedAt` を入力する
- `npm run validate:data` を実行する
- 画面で全問をプレビューする

GitHub Pagesでは問題JSONが公開されるため、この版のスコアは正式ランキングには使用しません。
