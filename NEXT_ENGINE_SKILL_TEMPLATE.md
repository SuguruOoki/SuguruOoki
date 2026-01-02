# Next Engine 自動化スキル - SKILL.md テンプレート

以下は `~/.claude/skills/next-engine/SKILL.md` として配置するファイルの内容です。

---

# Next Engine Automation Skill

## 概要
ネクストエンジンのEC運用における設定作業を自動化するClaude Codeスキルです。商品マスタ、在庫管理、発送・配送設定を効率的に管理できます。

---

## 主な機能

### 1. 商品マスタ同期
CSV/JSONファイルからネクストエンジンに商品情報を一括登録・更新

### 2. 在庫管理自動化
外部システムとの在庫連携、在庫アラート、倉庫別管理

### 3. 発送・配送設定
配送業者連携、送り状発行、追跡番号自動登録

---

## セットアップ

### 1. 依存関係のインストール

```bash
cd ~/.claude/skills/next-engine
npm install
```

### 2. 環境変数の設定

`.env` ファイルを作成し、Next Engine API認証情報を設定：

```bash
cp .env.example .env
```

`.env` の内容：

```env
# Next Engine API認証情報
NEXT_ENGINE_CLIENT_ID=your_client_id
NEXT_ENGINE_CLIENT_SECRET=your_client_secret
NEXT_ENGINE_REDIRECT_URI=https://your-domain.com/callback
NEXT_ENGINE_ACCESS_TOKEN=your_access_token
NEXT_ENGINE_REFRESH_TOKEN=your_refresh_token

# オプション：通知設定
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
NOTIFICATION_EMAIL=admin@example.com
```

### 3. 設定ファイルの準備

テンプレートから設定ファイルを作成：

```bash
cp ~/.claude/skills/next-engine/templates/product-config.yaml ./product-config.yaml
```

---

## 使用方法

### コマンド一覧

Claude Codeで以下のコマンドが使用できます：

#### 1. 商品マスタ同期

```
/user:next-engine:sync-products [config-file]
```

**例:**
```
/user:next-engine:sync-products ./product-config.yaml
```

商品データをCSV/JSONから読み込み、ネクストエンジンに同期します。

#### 2. 在庫更新

```
/user:next-engine:update-inventory [config-file]
```

**例:**
```
/user:next-engine:update-inventory ./inventory-config.yaml
```

在庫情報を外部システムから取得し、ネクストエンジンの在庫を更新します。

#### 3. 配送設定

```
/user:next-engine:configure-shipping [config-file]
```

**例:**
```
/user:next-engine:configure-shipping ./shipping-config.yaml
```

配送業者、配送方法の設定を一括で行います。

---

## 設定ファイルリファレンス

### 商品マスタ設定 (`product-config.yaml`)

```yaml
api:
  client_id: "${NEXT_ENGINE_CLIENT_ID}"
  client_secret: "${NEXT_ENGINE_CLIENT_SECRET}"
  access_token: "${NEXT_ENGINE_ACCESS_TOKEN}"

products:
  # データソース
  source:
    type: csv                    # csv, json, db
    path: ./data/products.csv
    encoding: utf-8

  # カラムマッピング
  mapping:
    product_code: "商品コード"
    product_name: "商品名"
    price: "販売価格"
    stock: "在庫数"
    category: "カテゴリ"

  # 実行オプション
  options:
    update_mode: upsert          # create, update, upsert
    batch_size: 100              # 1回のリクエストで処理する件数
    error_handling: skip         # skip, stop, rollback
    dry_run: false               # trueの場合、実際の更新は行わない

logging:
  level: info                    # debug, info, warn, error
  output: ./logs/sync.log
```

### 在庫管理設定 (`inventory-config.yaml`)

```yaml
api:
  client_id: "${NEXT_ENGINE_CLIENT_ID}"
  client_secret: "${NEXT_ENGINE_CLIENT_SECRET}"
  access_token: "${NEXT_ENGINE_ACCESS_TOKEN}"

inventory:
  source:
    type: api
    endpoint: "https://your-warehouse-api.com/inventory"
    headers:
      Authorization: "Bearer ${WAREHOUSE_API_TOKEN}"

  sync:
    schedule: "*/10 * * * *"     # cron形式
    warehouses:
      - warehouse_id: "WH001"
        name: "東京倉庫"
        priority: 1

  alerts:
    low_stock_threshold: 10
    notification:
      - type: slack
        webhook: "${SLACK_WEBHOOK_URL}"
      - type: email
        recipients: ["admin@example.com"]

  options:
    batch_size: 200
    sync_interval_minutes: 10
```

### 配送設定 (`shipping-config.yaml`)

```yaml
api:
  client_id: "${NEXT_ENGINE_CLIENT_ID}"
  client_secret: "${NEXT_ENGINE_CLIENT_SECRET}"
  access_token: "${NEXT_ENGINE_ACCESS_TOKEN}"

shipping:
  carriers:
    - carrier_id: "yamato"
      name: "ヤマト運輸"
      api_key: "${YAMATO_API_KEY}"
      tracking_url: "https://toi.kuronekoyamato.co.jp/cgi-bin/tneko"

    - carrier_id: "sagawa"
      name: "佐川急便"
      api_key: "${SAGAWA_API_KEY}"

  shipping_methods:
    - next_engine_id: "001"
      carrier_id: "yamato"
      service_type: "宅急便"
      default_size: "60"

  automation:
    auto_issue_slip: true
    auto_register_tracking: true
    notification_on_shipped: true
```

---

## 実行例

### 1. 商品マスタの同期

**準備:**

1. CSVファイルを用意 (`products.csv`)
```csv
商品コード,商品名,販売価格,在庫数,カテゴリ
PROD-001,商品A,1000,100,カテゴリ1
PROD-002,商品B,2000,50,カテゴリ2
```

2. 設定ファイルを編集 (`product-config.yaml`)

3. コマンド実行
```
/user:next-engine:sync-products ./product-config.yaml
```

**実行結果:**
```
🚀 Next Engine 商品マスタ同期開始
設定ファイル: ./product-config.yaml
Loaded 2 products from source
Processing batch 1/1
✅ 同期完了

Summary:
- Total: 2
- Success: 2
- Failed: 0
```

### 2. Dry Runモードでのテスト

実際の更新を行わずに動作確認：

```yaml
options:
  dry_run: true
```

---

## エラーハンドリング

### エラーの種類と対処

#### 1. 認証エラー (`AUTH_ERROR`)
**原因:** アクセストークンが無効または期限切れ

**対処:**
- アクセストークンを再取得
- `.env` ファイルを更新

#### 2. レート制限エラー (`RATE_LIMIT`)
**原因:** APIリクエスト制限超過（60リクエスト/分）

**対処:**
- `batch_size` を小さくする
- 自動リトライが実行されるため、通常は待機すれば解決

#### 3. バリデーションエラー (`VALIDATION_ERROR`)
**原因:** データ形式が不正

**対処:**
- エラーログで該当行を確認
- マッピング設定を見直し
- ソースデータを修正

#### 4. APIエラー (`API_ERROR`)
**原因:** Next Engine API側のエラー

**対処:**
- エラーメッセージを確認
- Next Engine API仕様を確認
- 必要に応じてサポートに問い合わせ

---

## ログとレポート

### ログファイル

実行ログは指定したパスに出力されます：

```
./logs/sync.log
```

**ログ形式:**
```json
{
  "timestamp": "2026-01-02T12:00:00Z",
  "level": "info",
  "message": "Sync completed",
  "context": {
    "total": 1000,
    "success": 980,
    "failed": 20
  }
}
```

### 実行レポート

実行完了後、以下の情報を含むレポートが生成されます：

```json
{
  "execution_id": "uuid-v4",
  "started_at": "2026-01-02T12:00:00Z",
  "completed_at": "2026-01-02T12:05:30Z",
  "duration_seconds": 330,
  "status": "success",
  "summary": {
    "total_processed": 1000,
    "success": 980,
    "failed": 20,
    "skipped": 0
  },
  "errors": [
    {
      "line": 45,
      "product_code": "PROD-001",
      "error": "Validation failed: Invalid price"
    }
  ]
}
```

---

## パフォーマンスガイド

### 推奨設定

| データ量 | batch_size | 推定処理時間 |
|---------|-----------|------------|
| 100件 | 100 | 1分 |
| 1,000件 | 100 | 5分 |
| 10,000件 | 200 | 45分 |

### 最適化のヒント

1. **バッチサイズの調整**
   - 小さすぎるとAPI呼び出しが増える
   - 大きすぎるとタイムアウトのリスク
   - 推奨: 100-200件

2. **並列処理**
   - 現在の実装は直列処理
   - 将来的に並列処理オプションを追加予定

3. **レート制限対策**
   - 自動的に待機処理を実装済み
   - 必要に応じて処理間隔を調整

---

## トラブルシューティング

### よくある問題

#### Q1. 「Authentication failed」エラーが出る
**A:** アクセストークンの有効期限を確認してください。リフレッシュトークンで再取得が必要です。

#### Q2. 一部の商品だけ同期できない
**A:** エラーログで該当商品を確認し、データフォーマットをチェックしてください。`error_handling: skip` により、エラー商品はスキップされます。

#### Q3. 処理が遅い
**A:** `batch_size` を大きくするか、データソースの読み込みを高速化してください。

#### Q4. メモリ不足エラーが出る
**A:** 大量データの場合、ストリーミング処理への切り替えを検討してください。

---

## セキュリティ

### ベストプラクティス

1. **認証情報の管理**
   - `.env` ファイルを `.gitignore` に追加
   - 環境変数を使用
   - 本番環境では暗号化ストレージを使用

2. **アクセス制御**
   - 最小権限の原則
   - API キーの定期ローテーション
   - 監査ログの記録

3. **データ保護**
   - 機密データのログ出力禁止
   - 通信はHTTPSのみ
   - 個人情報の暗号化

---

## 制限事項

### API制限
- **レート制限**: 60リクエスト/分
- **バッチサイズ**: 最大1000件/リクエスト
- **タイムアウト**: 30秒

### データ制限
- **ファイルサイズ**: CSV最大100MB推奨
- **同時処理**: 1プロセスのみ

---

## サポート

### ドキュメント
- [Next Engine Developer Network](https://developer.next-engine.com/)
- [API リファレンス](https://developer.next-engine.com/api)

### 問い合わせ
- GitHub Issues: [リポジトリURL]
- Email: support@example.com

---

## 更新履歴

### v1.0.0 (2026-01-02)
- 初回リリース
- 商品マスタ同期機能
- 在庫管理機能
- 配送設定機能

---

**Last Updated**: 2026-01-02
**Version**: 1.0.0
**License**: MIT
