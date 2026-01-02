# Business Idea Hunter 🎯

SNS・テックメディアから「不満」「課題」「欲しい」を自動収集し、Claudeでビジネスアイデアに変換してNotionに蓄積するツール。

## データソース

| ソース | 方式 | 対象 |
|--------|------|------|
| note | RSS | トレンド記事 |
| Zenn | RSS | トレンド記事 |
| HackerNews | API | Show HN, Ask HN |
| Reddit | API | 特定Subreddit |
| X (Twitter) | クローリング | 検索キーワード |
| Instagram | クローリング | ハッシュタグ |
| TikTok | クローリング | トレンド・コメント |

## セットアップ

### 1. 依存関係インストール

```bash
npm install
npx playwright install chromium
```

### 2. 環境変数設定

```bash
cp .env.example .env
# .envを編集
```

必要なAPI:
- `ANTHROPIC_API_KEY`: Claude API
- `NOTION_API_KEY`: Notion Integration Token
- `NOTION_DATABASE_ID`: 保存先データベースID

### 3. Notionデータベース作成

```bash
npm run setup:notion <親ページID>
```

または手動で以下のプロパティを持つDBを作成:
- Title (title): アイデアタイトル
- Source (select): データソース
- Category (select): カテゴリ
- Pain Point (rich_text): 課題・不満
- Idea (rich_text): ビジネスアイデア
- Potential (select): 可能性 (High/Medium/Low)
- Original URL (url): 元ソース
- Collected At (date): 収集日時

### 4. 設定ファイル編集

`config.yaml` でキーワード・Subredditなどを設定

## 使用方法

### 全ソース収集
```bash
npm start
```

### 特定ソース指定
```bash
npm start -- --sources note,zenn,reddit
```

### ドライラン（Notion保存なし）
```bash
npm start -- --dry-run
```

## 定期実行

### cron (Linux/Mac)
```bash
# 毎日9時に実行
0 9 * * * cd /path/to/business-idea-hunter && npm start >> logs/cron.log 2>&1
```

### GitHub Actions
`.github/workflows/collect.yml` を参照

## プロジェクト構成

```
business-idea-hunter/
├── src/
│   ├── main.ts              # メイン実行
│   ├── analyzer.ts          # Claude分析
│   ├── notion.ts            # Notion保存
│   ├── config.ts            # 設定読み込み
│   ├── types.ts             # 型定義
│   └── collectors/
│       ├── base.ts          # ベースクラス
│       ├── rss.ts           # note, Zenn
│       ├── hackernews.ts
│       ├── reddit.ts
│       ├── x.ts             # クローリング
│       ├── instagram.ts     # クローリング
│       └── tiktok.ts        # クローリング
├── scripts/
│   └── setup-notion.ts      # Notion DB作成
├── .github/workflows/
│   └── collect.yml          # 定期実行
├── config.yaml              # 検索キーワード設定
├── package.json
└── tsconfig.json
```

## ⚠️ 注意事項

- X/Instagram/TikTokのクローリングは利用規約違反の可能性があります
- 個人利用・研究目的に限定してください
- 低頻度（1日1-2回）での実行を推奨
- 商用利用は各プラットフォームのAPIを正規契約してください
