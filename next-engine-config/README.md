# Next Engine 設定ファイル

楽天市場・Amazon連携用のネクストエンジン設定テンプレートです。

## セットアップ手順

### 1. 環境変数の設定

```bash
# .env.example を .env にコピー
cp .env.example .env

# 認証情報を編集
vi .env
```

### 2. API認証情報の取得

1. [Next Engine Developer Network](https://developer.next-engine.com/) にアクセス
2. アプリケーションを登録
3. Client ID / Client Secret を `.env` に設定

### 3. OAuth認証の実行

```bash
# 認証URLにアクセス
https://api.next-engine.org/api_neauth?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI

# 認証後、コールバックで取得したコードでトークンを取得
```

## ファイル一覧

| ファイル | 説明 |
|---------|------|
| `.env.example` | 環境変数テンプレート |
| `product-config.yaml` | 商品マスタ設定（既存商品考慮対応） |
| `inventory-config.yaml` | 在庫管理設定 |
| `shipping-config.yaml` | 配送設定 |
| `api-config.yaml` | API使用量制限設定 |
| `api-usage.json.example` | API使用状況ファイルのテンプレート |
| `cache/` | 既存商品キャッシュ保存先 |
| `logs/` | 同期ログ・差分レポート保存先 |

## 連携モール

- 楽天市場
- Amazon（自社出荷）

## 既存商品を考慮した同期

商品マスタ同期では、既存商品を事前に取得し差分を検出します。

### 同期フロー

```
1. 既存商品取得 → 2. 差分検出 → 3. 確認 → 4. 同期実行
```

### 差分検出の分類

| 分類 | 説明 | デフォルト動作 |
|------|------|---------------|
| NEW | 新規商品 | 登録 |
| CHANGED | 変更あり | 更新 |
| UNCHANGED | 変更なし | スキップ |
| ORPHANED | ソースにない既存商品 | 警告 |

### 設定例（product-config.yaml）

```yaml
existing_products:
  enabled: true
  sync_behavior:
    on_new: insert
    on_changed: update
    on_unchanged: skip
    on_orphaned: warn
```

## API使用量制限

Next Engine APIは月1000回までの無料枠があり、それを超えると課金が発生します。
このリポジトリでは、API使用量を自動的に追跡して課金を防止する仕組みを提供しています。

### 管理方法の選択

API使用量の管理には2つの方法があります：

1. **ローカル管理**（シンプル）: `api-usage.json` ファイルで管理
2. **リモート管理**（推奨）: Cloudflare Workers + D1 データベースで一元管理

#### リモート管理のメリット

- 複数環境（ローカル、CI/CD等）から同じAPI使用状況を共有
- データベースで永続化され、履歴を保持
- 認証機能でセキュアにアクセス
- 障害時はローカルにフォールバック可能
- テスト環境のコールは自動的にカウント対象外
- **90%到達時点で自動ブロック**

### 初期セットアップ（ローカル管理）

```bash
# API使用状況ファイルを作成
cp api-usage.json.example api-usage.json
```

### リモート管理セットアップ（推奨）

Cloudflare Workersを使用した一元管理を行う場合：

#### 1. Cloudflare Workers のデプロイ

```bash
cd workers/api-usage-manager

# 依存関係をインストール
npm install

# Cloudflareにログイン
wrangler login

# D1データベースを作成
wrangler d1 create next-engine-api-usage

# 出力されたdatabase_idをwrangler.tomlに設定
# [[d1_databases]]
# database_id = "YOUR_D1_DATABASE_ID"

# スキーマを適用
wrangler d1 execute next-engine-api-usage --file=./schema.sql

# API Keyを生成・設定
openssl rand -hex 32  # キーを生成
wrangler secret put API_KEY  # 生成したキーを入力

# 本番環境にデプロイ
wrangler deploy
```

#### 2. ローカル環境の設定

```bash
# 環境変数を設定（.envに追加）
export NEXT_ENGINE_API_MANAGER_URL="https://next-engine-api-manager.YOUR-SUBDOMAIN.workers.dev"
export NEXT_ENGINE_API_MANAGER_KEY="your-api-key-here"
export NEXT_ENGINE_ENV="production"  # または "test"
```

#### 3. api-config.yaml の更新

```yaml
usage_tracking:
  mode: hybrid  # remote-first with local fallback

  remote:
    enabled: true
    api_url: "https://next-engine-api-manager.YOUR-SUBDOMAIN.workers.dev"
    auth:
      api_key_env: NEXT_ENGINE_API_MANAGER_KEY
    fallback:
      use_local_on_failure: true
```

詳細は `workers/api-usage-manager/README.md` を参照してください。

#### 4. 他のCloudflare Workersとの統合

認証トークン自動更新Workerなど、他のNext Engine関連Workerからもリモート管理を利用できます。

**統合ガイド**: `workers/auth-integration-guide.md` を参照

**主な統合ポイント:**
- トークン自動更新時のAPIコールを記録
- 1日2回のCron実行でも自動カウント
- 90%到達時に自動ブロックして課金防止

### 使用量の確認

API使用状況は `api-usage.json` に自動記録されます：

```json
{
  "usage": {
    "total_calls": 245,
    "successful_calls": 240,
    "failed_calls": 5
  },
  "limits": {
    "monthly_limit": 1000,
    "remaining": 755,
    "used_percent": 24.5
  }
}
```

### 上限設定のカスタマイズ

`api-config.yaml` で上限を変更できます：

```yaml
usage_limits:
  monthly_limit: 1000  # 月間上限（お好みの値に変更可能）
  warning_threshold_percent: 80   # 警告閾値（80%で警告）
  danger_threshold_percent: 90    # 危険閾値（90%で危険警告）

  on_limit_reached:
    behavior: block  # block: APIコール停止 / warn: 警告のみ
```

### 自動リセット

デフォルトでは毎月1日に自動的にカウントがリセットされます：

```yaml
usage_tracking:
  reset:
    type: monthly  # monthly: 毎月自動リセット / manual: 手動のみ
    day_of_month: 1
```

### 手動リセット

使用状況を手動でリセットする場合：

```bash
# api-usage.jsonを削除して再作成
rm api-usage.json
cp api-usage.json.example api-usage.json
```

### アラート

設定した閾値に達すると自動的にアラートが表示されます：

- **80%到達**: ⚠️ 警告（残り200回）
- **90%到達**: 🚨 危険警告（残り100回）
- **100%到達**: 🛑 APIコールをブロック（設定による）

### 使用状況レポート

月次レポートは `logs/usage-reports/` に自動生成されます。

## 次のステップ

1. `.env` ファイルに認証情報を設定
2. `api-usage.json` を作成（`cp api-usage.json.example api-usage.json`）
3. `/user:next-engine-sync --diff-only` で差分確認
4. `/user:next-engine-sync` で商品同期
5. `/user:next-engine-inventory` で在庫同期
