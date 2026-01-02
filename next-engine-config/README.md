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

## 次のステップ

1. `.env` ファイルに認証情報を設定
2. `/user:next-engine-sync --diff-only` で差分確認
3. `/user:next-engine-sync` で商品同期
4. `/user:next-engine-inventory` で在庫同期
