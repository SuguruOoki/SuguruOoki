# Next Engine API使用量管理サービス

Cloudflare Workersで動作するNext Engine APIの使用量を管理するサービスです。

## 機能

- API使用量のリモート管理（D1データベース）
- 本番環境のみカウント（テスト環境は無料）
- 90%到達時に自動ブロック
- ローカル・CI/CD環境から集中管理
- 認証機能（API Key）

## セットアップ

### 1. D1データベースの作成

```bash
# Cloudflareアカウントでログイン
wrangler login

# D1データベースを作成
wrangler d1 create next-engine-api-usage

# 出力されたdatabase_idをwrangler.tomlに設定
```

### 2. スキーマの適用

```bash
# ローカル環境（開発用）
wrangler d1 execute next-engine-api-usage --local --file=./schema.sql

# 本番環境
wrangler d1 execute next-engine-api-usage --file=./schema.sql
```

### 3. API Keyの設定

```bash
# API認証キーを生成（例: openssl rand -hex 32）
openssl rand -hex 32

# Cloudflare Workers Secretに設定
wrangler secret put API_KEY
# プロンプトで生成したキーを入力

# ローカル開発用は .dev.vars ファイルに設定
echo 'API_KEY="your-generated-key-here"' > .dev.vars
```

### 4. デプロイ

```bash
# ローカル開発サーバー起動
npm run dev
# または
wrangler dev

# 本番環境にデプロイ
npm run deploy
# または
wrangler deploy
```

## API エンドポイント

### 1. 使用状況を取得

```bash
GET /api/usage

# 例
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://next-engine-api-manager.YOUR-SUBDOMAIN.workers.dev/api/usage
```

**レスポンス:**
```json
{
  "period": "2026-01",
  "usage": {
    "total_calls": 245,
    "successful_calls": 240,
    "failed_calls": 5,
    "production_calls": 245,
    "test_calls": 150
  },
  "limits": {
    "monthly_limit": 1000,
    "remaining": 755,
    "used_percent": 24.5
  }
}
```

### 2. 実行可否をチェック

```bash
POST /api/usage/check

# 本番環境
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"environment":"production"}' \
  https://next-engine-api-manager.YOUR-SUBDOMAIN.workers.dev/api/usage/check

# テスト環境
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"environment":"test"}' \
  https://next-engine-api-manager.YOUR-SUBDOMAIN.workers.dev/api/usage/check
```

**レスポンス（許可）:**
```json
{
  "allowed": true,
  "warning": "⚠️ Warning: 85.0% API usage",
  "usage": {
    "total_calls": 850,
    "remaining": 150,
    "used_percent": 85.0
  }
}
```

**レスポンス（ブロック）:**
```json
{
  "allowed": false,
  "reason": "API limit reached: 91.0% used (910/1000 calls)",
  "usage": {
    "total_calls": 910,
    "remaining": 90,
    "used_percent": 91.0
  },
  "threshold": 90
}
```

### 3. API使用を記録

```bash
POST /api/usage/record

curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "receiveorder/product/search",
    "success": true,
    "environment": "production"
  }' \
  https://next-engine-api-manager.YOUR-SUBDOMAIN.workers.dev/api/usage/record
```

**レスポンス:**
```json
{
  "success": true,
  "usage": {
    "total_calls": 246,
    "remaining": 754,
    "used_percent": 24.6
  },
  "environment": "production",
  "counted": true
}
```

### 4. 使用状況をリセット

```bash
POST /api/usage/reset

curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  https://next-engine-api-manager.YOUR-SUBDOMAIN.workers.dev/api/usage/reset
```

## 環境変数

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| `API_KEY` | API認証キー（必須） | - |
| `MONTHLY_LIMIT` | 月間上限 | 1000 |

## セキュリティ

- API Keyによる認証
- CORS対応（必要に応じて制限可能）
- D1データベースでの永続化

## 料金

- Cloudflare Workers: 月10万リクエストまで無料
- D1データベース: 月500万行の読み取り/100万行の書き込みまで無料

Next Engine APIの使用量管理には十分な無料枠です。

## トラブルシューティング

### D1データベースが見つからない

```bash
# D1データベース一覧を確認
wrangler d1 list

# データベースの内容を確認
wrangler d1 execute next-engine-api-usage --command="SELECT * FROM api_usage"
```

### API Keyが認証されない

```bash
# Secretの一覧を確認
wrangler secret list

# API Keyを再設定
wrangler secret put API_KEY
```

## ローカル開発

```bash
# 依存関係をインストール
npm install

# ローカル開発サーバー起動
npm run dev

# テスト
curl -H "Authorization: Bearer test-key" \
  http://localhost:8787/api/usage
```

## 他のCloudflare Workersとの統合

他のNext Engine関連のCloudflare Workers（例：認証トークン自動更新Worker）からもAPI使用量を記録できます。

### 統合例

認証Workerなど、他のWorkerからAPI使用量を記録する場合：

```typescript
// 他のWorker側の実装
const response = await fetch(
  'https://next-engine-api-manager.YOUR-SUBDOMAIN.workers.dev/api/usage/record',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${YOUR_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint: 'api_v1_login_company/info',  // Next Engine APIエンドポイント
      success: true,
      environment: 'production'  // または 'test'
    })
  }
);
```

詳細は `../auth-integration-guide.md` を参照してください。

### 統合するWorkerの例

- **認証トークン自動更新Worker**: トークン更新時のAPIコールを記録
- **商品同期Worker**: 商品マスタ取得・更新のAPIコールを記録
- **在庫更新Worker**: 在庫更新のAPIコールを記録

すべてのNext Engine APIコールを一元管理することで、月1000回の無料枠を効率的に使用できます。
