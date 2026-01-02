# /user:next-engine-sync - 商品マスタ同期コマンド

## 概要
ネクストエンジンの商品マスタを同期するコマンドです。CSVファイルやAPIからの商品データをネクストエンジンに一括登録・更新します。

## 使用方法
```
/user:next-engine-sync [設定ファイルパス or オプション]
```

## 実行フロー

### 1. 設定確認
- 環境変数（NEXT_ENGINE_*）の確認
- 設定ファイル（product-config.yaml）の読み込み
- データソース（CSV/JSON/DB）の検証

### 2. 既存商品の取得（NEW）
- Next Engine API から既存商品を全件取得
- 商品コードをキーにインデックス作成
- キャッシュファイルに保存（次回高速化）

### 3. データ準備・差分検出
- ソースデータの読み込み
- 商品コードマッピング（マルチモール対応）
- バリデーション実行
- **既存商品との差分検出**:
  - `NEW`: 新規登録対象
  - `CHANGED`: 更新対象（変更フィールドを記録）
  - `UNCHANGED`: スキップ対象
  - `ORPHANED`: ソースにない既存商品（警告）

### 4. 差分確認（インタラクティブ）
- 差分サマリーを表示
- ユーザー確認後に実行（--yes で自動承認）

### 5. API同期
- Next Engine API 認証
- NEW商品を登録（バッチ処理）
- CHANGED商品を更新（バッチ処理）
- エラーハンドリング（skip/stop/rollback）

### 6. レポート生成
- 処理件数（新規/更新/スキップ/失敗）
- 変更詳細ログ（差分内容）
- エラー詳細ログ
- 実行時間

## 設定ファイル例 (product-config.yaml)

```yaml
api:
  client_id: "${NEXT_ENGINE_CLIENT_ID}"
  client_secret: "${NEXT_ENGINE_CLIENT_SECRET}"
  access_token: "${NEXT_ENGINE_ACCESS_TOKEN}"

products:
  source:
    type: csv
    path: ./data/products.csv
    encoding: utf-8

  mapping:
    product_code: "商品コード"
    product_name: "商品名"
    price: "販売価格"
    stock: "在庫数"
    category: "カテゴリ"

  # マルチモール対応
  mall_specific_attributes:
    enabled: true
    rakuten:
      - rakuten_product_name
      - rakuten_price
    amazon:
      - amazon_title
      - amazon_price

  options:
    update_mode: upsert  # create, update, upsert
    batch_size: 100
    error_handling: skip  # skip, stop, rollback
    dry_run: false

logging:
  level: info
  output: ./logs/product-sync.log
```

## オプション

| オプション | 説明 | デフォルト |
|-----------|------|----------|
| --config | 設定ファイルパス | ./product-config.yaml |
| --dry-run | 実際に更新せずテスト実行 | false |
| --batch-size | バッチサイズ | 100 |
| --verbose | 詳細ログ出力 | false |
| --yes | 差分確認をスキップして自動実行 | false |
| --no-cache | 既存商品キャッシュを使用しない | false |
| --diff-only | 差分検出のみ（同期は実行しない） | false |
| --include-unchanged | 変更なし商品もログに出力 | false |

## 出力例

```
🚀 Next Engine 商品マスタ同期開始
設定ファイル: ./product-config.yaml

📥 既存商品を取得中...
  取得完了: 1,500件（キャッシュ: 2026-01-02 10:00）

📊 ソースデータ読み込み完了: 1,234件

🔍 差分検出中...

📋 差分検出結果:
  ┌─────────────────────────────────────────┐
  │ NEW (新規登録)      :    50件           │
  │ CHANGED (更新)      :   150件           │
  │ UNCHANGED (スキップ):  1,034件          │
  │ ORPHANED (既存のみ) :   266件 ⚠️        │
  └─────────────────────────────────────────┘

📝 主な変更内容:
  - 価格変更: 80件
  - 商品名変更: 45件
  - 在庫数変更: 120件

続行しますか？ [y/N]: y

⏳ 同期処理中...
  新規登録: [████████████████████████████████████████] 50/50
  更新処理: [████████████████████████████████████████] 150/150

✅ 同期完了
  - 新規登録: 50件
  - 更新: 148件
  - 更新失敗: 2件
  - スキップ: 1,034件

📝 レポート: ./logs/product-sync-20260102.log
📝 差分詳細: ./logs/product-diff-20260102.json
```

## 差分レポート形式

```json
{
  "sync_id": "sync-20260102-100000",
  "timestamp": "2026-01-02T10:00:00+09:00",
  "summary": {
    "new": 50,
    "changed": 150,
    "unchanged": 1034,
    "orphaned": 266
  },
  "changes": [
    {
      "product_code": "PROD-001",
      "status": "CHANGED",
      "changes": {
        "price": { "old": 1000, "new": 1200 },
        "product_name": { "old": "商品A", "new": "商品A（改良版）" }
      }
    }
  ]
}
```

## スキル参照
- @skills/next-engine/SKILL.md

## エラーハンドリング

### 認証エラー
アクセストークンの期限切れ時は自動リフレッシュを試行

### レート制限
API制限（60リクエスト/分）超過時は指数バックオフでリトライ

### バリデーションエラー
error_handling設定に従い、skip（継続）/stop（停止）/rollback（ロールバック）
