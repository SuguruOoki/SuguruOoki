# /user:next-engine-inventory - 在庫更新コマンド

## 概要
ネクストエンジンの在庫情報を更新するコマンドです。倉庫システムやCSVから在庫データを取得し、モール別または統合在庫として同期します。

## 使用方法
```
/user:next-engine-inventory [設定ファイルパス or オプション]
```

## 実行フロー

### 1. 設定確認
- 環境変数の確認
- 在庫設定ファイル（inventory-config.yaml）の読み込み
- 在庫モード（統合/モール別）の確認

### 2. 在庫データ取得
- 倉庫API/CSVからデータ取得
- 倉庫別在庫の集計
- 安全在庫の計算

### 3. 在庫同期
- Next Engine API で在庫更新
- モール別配分（設定に応じて）
- アラート判定

### 4. アラート送信
- 低在庫アラート
- 在庫切れ通知
- Slack/メール通知

## 設定ファイル例 (inventory-config.yaml)

```yaml
api:
  client_id: "${NEXT_ENGINE_CLIENT_ID}"
  client_secret: "${NEXT_ENGINE_CLIENT_SECRET}"
  access_token: "${NEXT_ENGINE_ACCESS_TOKEN}"

inventory:
  # 在庫モード
  mode: unified  # unified（統合）or mall_specific（モール別）

  source:
    type: api  # api, csv
    endpoint: "https://your-warehouse-api.com/inventory"
    headers:
      Authorization: "Bearer ${WAREHOUSE_API_TOKEN}"

  # 統合在庫モード設定
  unified_settings:
    priority_order:
      - amazon      # 優先順位1
      - rakuten
      - yahoo
      - qoo10
    buffer_stock: 10
    oversell_protection: true
    sync_interval_minutes: 5

  # モール別在庫モード設定
  mall_specific_settings:
    allocation:
      rakuten: 30%
      amazon: 40%
      qoo10: 15%
      yahoo: 15%
    auto_rebalance: true
    rebalance_interval: daily

  # 倉庫設定
  warehouses:
    - warehouse_id: "WH001"
      name: "東京倉庫"
      priority: 1
    - warehouse_id: "WH002"
      name: "大阪倉庫"
      priority: 2

  # アラート設定
  alerts:
    low_stock_threshold: 10
    notification:
      - type: email
        recipients: ["admin@example.com"]
      - type: slack
        webhook: "${SLACK_WEBHOOK_URL}"

  options:
    batch_size: 200
    sync_interval_minutes: 10
```

## オプション

| オプション | 説明 | デフォルト |
|-----------|------|----------|
| --config | 設定ファイルパス | ./inventory-config.yaml |
| --mode | 在庫モード（unified/mall_specific） | unified |
| --dry-run | テスト実行 | false |
| --rebalance | 在庫再配分を実行 | false |

## 出力例

```
📦 Next Engine 在庫更新開始
設定ファイル: ./inventory-config.yaml
在庫モード: 統合在庫

📊 倉庫データ取得完了
  - 東京倉庫: 5,000 SKU
  - 大阪倉庫: 3,200 SKU

⏳ 在庫同期中...
  [████████████████████████████████████████] 100%

⚠️ 低在庫アラート
  - SKU-001: 残り 5個
  - SKU-002: 残り 8個

✅ 在庫更新完了
  - 更新: 8,200件
  - アラート: 2件

🔔 通知送信完了（Slack, Email）
```

## スキル参照
- @skills/next-engine/SKILL.md

## 在庫モード詳細

### 統合在庫モード
全モールで共通の在庫を管理。売れ行きに応じて優先順位を付けて引き当て。

### モール別在庫モード
各モールに固定割合で在庫を配分。自動再配分オプションで売れ行きに応じた調整も可能。
