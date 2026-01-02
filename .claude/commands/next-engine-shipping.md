# /user:next-engine-shipping - 配送設定コマンド

## 概要
ネクストエンジンの配送設定を管理するコマンドです。配送業者の設定、配送方法のマッピング、送り状発行の自動化を行います。

## 使用方法
```
/user:next-engine-shipping [設定ファイルパス or オプション]
```

## 実行フロー

### 1. 設定確認
- 環境変数の確認
- 配送設定ファイル（shipping-config.yaml）の読み込み
- 配送業者APIの接続確認

### 2. 配送業者設定
- 配送業者マスタの同期
- 配送方法のマッピング
- 料金テーブルの設定

### 3. 自動化設定
- 送り状自動発行の設定
- 追跡番号自動登録の設定
- 出荷通知の設定

### 4. 確認
- 設定内容の検証
- テスト配送データの確認

## 設定ファイル例 (shipping-config.yaml)

```yaml
api:
  client_id: "${NEXT_ENGINE_CLIENT_ID}"
  client_secret: "${NEXT_ENGINE_CLIENT_SECRET}"
  access_token: "${NEXT_ENGINE_ACCESS_TOKEN}"

shipping:
  # 配送業者設定
  carriers:
    - carrier_id: "yamato"
      name: "ヤマト運輸"
      api_key: "${YAMATO_API_KEY}"
      tracking_url: "https://toi.kuronekoyamato.co.jp/cgi-bin/tneko"
      services:
        - id: "takkyubin"
          name: "宅急便"
          sizes: ["60", "80", "100", "120", "140", "160"]
        - id: "nekopos"
          name: "ネコポス"
          max_weight: 1000  # グラム

    - carrier_id: "sagawa"
      name: "佐川急便"
      api_key: "${SAGAWA_API_KEY}"
      tracking_url: "https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do"
      services:
        - id: "hikyaku"
          name: "飛脚宅配便"
        - id: "hikyaku_express"
          name: "飛脚航空便"

    - carrier_id: "japanpost"
      name: "日本郵便"
      api_key: "${JAPANPOST_API_KEY}"
      services:
        - id: "yupack"
          name: "ゆうパック"
        - id: "clickpost"
          name: "クリックポスト"

  # 配送方法マッピング
  shipping_methods:
    - next_engine_id: "001"
      carrier_id: "yamato"
      service_type: "takkyubin"
      default_size: "60"
      conditions:
        max_weight: 25000
        max_total_size: 160  # 三辺計

    - next_engine_id: "002"
      carrier_id: "yamato"
      service_type: "nekopos"
      conditions:
        max_weight: 1000
        max_thickness: 30  # mm

    - next_engine_id: "003"
      carrier_id: "sagawa"
      service_type: "hikyaku"

  # サイズ自動判定
  size_calculation:
    enabled: true
    rules:
      - if: "weight <= 2000 && total_size <= 60"
        size: "60"
      - if: "weight <= 5000 && total_size <= 80"
        size: "80"
      - if: "weight <= 10000 && total_size <= 100"
        size: "100"

  # 自動化設定
  automation:
    auto_issue_slip: true          # 送り状自動発行
    auto_register_tracking: true   # 追跡番号自動登録
    notification_on_shipped: true  # 出荷通知

    # 送り状発行タイミング
    slip_issue_timing:
      trigger: "order_confirmed"   # order_confirmed, payment_confirmed, manual
      delay_minutes: 0

    # 出荷通知設定
    shipping_notification:
      send_to_customer: true
      template: "default"
      include_tracking_link: true

  # 送料設定
  shipping_fees:
    calculation_method: "zone_based"  # zone_based, weight_based, flat
    free_shipping_threshold: 5000     # 円

logging:
  level: info
  output: ./logs/shipping-config.log
```

## オプション

| オプション | 説明 | デフォルト |
|-----------|------|----------|
| --config | 設定ファイルパス | ./shipping-config.yaml |
| --sync | 配送業者マスタを同期 | false |
| --test | テストモードで実行 | false |
| --validate | 設定の検証のみ | false |

## 出力例

```
🚚 Next Engine 配送設定開始
設定ファイル: ./shipping-config.yaml

📦 配送業者設定
  - ヤマト運輸: 接続OK
  - 佐川急便: 接続OK
  - 日本郵便: 接続OK

🔗 配送方法マッピング
  - 001 → ヤマト宅急便
  - 002 → ネコポス
  - 003 → 佐川飛脚便

⚙️ 自動化設定
  - 送り状自動発行: 有効
  - 追跡番号自動登録: 有効
  - 出荷通知: 有効

✅ 配送設定完了
```

## スキル参照
- @skills/next-engine/SKILL.md

## 配送業者別注意事項

### ヤマト運輸
- B2クラウド連携が必要
- ネコポスは発払いのみ対応

### 佐川急便
- e飛伝API連携が必要
- 法人契約が必要

### 日本郵便
- ゆうパックプリントR連携
- クリックポストは前払い
