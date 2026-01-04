# Next Engine TODO マネジメントシステム

複数のNext Engine設定プロジェクトを並行管理し、共通タスクとモール別タスクを分離して進捗管理を行うシステムです。

## クイックスタート

```bash
# ダッシュボード表示
npm run todo

# 新規プロジェクト作成
npm run todo create

# プロジェクト一覧
npm run todo list

# TODO一覧表示
npm run todo show <project-id>
```

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `npm run todo` | ダッシュボード表示（全プロジェクトの進捗概要） |
| `npm run todo list` | プロジェクト一覧 |
| `npm run todo create` | 新規プロジェクト作成（対話式） |
| `npm run todo show <id>` | 全TODO一覧表示 |
| `npm run todo show <id> common` | 共通タスクのみ表示 |
| `npm run todo show <id> rakuten` | 楽天タスクのみ表示 |
| `npm run todo show <id> amazon` | Amazonタスクのみ表示 |
| `npm run todo show <id> qoo10` | Qoo10タスクのみ表示 |
| `npm run todo show <id> yahoo` | Yahoo!タスクのみ表示 |
| `npm run todo start <id> <task>` | タスク開始 |
| `npm run todo complete <id> <task>` | タスク完了 |
| `npm run todo skip <id> <task>` | タスクスキップ |
| `npm run todo reset <id> <task>` | タスクをリセット |

## ディレクトリ構造

```
data/
├── configs/
│   ├── config-schema.json    # 設定スキーマ
│   └── projects.json         # プロジェクト一覧
└── todos/
    ├── templates/
    │   ├── common-tasks.json   # 共通タスクテンプレート
    │   ├── rakuten-tasks.json  # 楽天タスクテンプレート
    │   ├── amazon-tasks.json   # Amazonタスクテンプレート
    │   ├── qoo10-tasks.json    # Qoo10タスクテンプレート
    │   └── yahoo-tasks.json    # Yahoo!タスクテンプレート
    └── <project-id>.json       # プロジェクトごとのTODO
```

## タスク構造

### 共通タスク（16タスク）

全モールで必要な基本設定：

1. **認証設定**（5タスク）
   - Developer Networkアカウント作成
   - APIアプリケーション登録
   - Cloudflare Worker デプロイ
   - OAuth認証完了
   - トークン自動更新設定

2. **基本設定**（3タスク）
   - 会社情報の確認・更新
   - 倉庫・在庫拠点の設定
   - 配送業者の設定

3. **商品設定**（4タスク）
   - 商品カテゴリの定義
   - 商品コード体系の決定
   - 商品マスタCSV準備
   - 商品マスタインポート

4. **在庫設定**（2タスク）
   - 在庫管理方針の決定
   - 安全在庫の設定

5. **運用設定**（2タスク）
   - 通知・アラート設定
   - バックアップ・ログ設定

### モール別タスク

各モールで10〜13タスク：

| モール | タスク数 | 主な設定内容 |
|--------|---------|--------------|
| 楽天市場 | 12 | RMS連携、あす楽設定 |
| Amazon | 13 | SP-API、FBA/FBM設定 |
| Qoo10 | 10 | QSM連携 |
| Yahoo! | 11 | ストアクリエイター連携、優良配送 |

## 優先度

タスクには3段階の優先度があります：

- 🔴 **high**: 運用開始に必須
- 🟡 **medium**: 推奨設定
- 🟢 **low**: オプション

## ステータス

- ⬜ **pending**: 未着手
- 🔄 **in_progress**: 進行中
- ✅ **completed**: 完了
- ⏭️ **skipped**: スキップ

## 複数プロジェクト管理

複数のNext Engine設定を同時に管理できます：

```bash
# 例: 2つの店舗を管理
npm run todo create
# → bjc-main (BJC本店) を作成

npm run todo create
# → bjc-outlet (BJCアウトレット) を作成

# 個別に進捗確認
npm run todo show bjc-main
npm run todo show bjc-outlet

# ダッシュボードで全体確認
npm run todo
```

各プロジェクトは独立した`.env`ファイルを持ちます：
- `.env.bjc-main`
- `.env.bjc-outlet`

## 使用例

```bash
# 1. プロジェクト作成
npm run todo create
# プロジェクトID: bjc-main
# プロジェクト名: BJC本店
# モール選択: 1,2,3,4 (全モール)

# 2. TODO確認
npm run todo show bjc-main

# 3. タスク開始
npm run todo start bjc-main rakuten-001

# 4. タスク完了
npm run todo complete bjc-main rakuten-001

# 5. 楽天のみ確認
npm run todo show bjc-main rakuten
```

## カスタマイズ

### タスクテンプレートの編集

`data/todos/templates/` 内のJSONファイルを編集することで、
タスク内容をカスタマイズできます。

### 新規モールの追加

1. `data/todos/templates/<mall>-tasks.json` を作成
2. `scripts/todo-manager.ts` のモールマップに追加
