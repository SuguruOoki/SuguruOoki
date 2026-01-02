# Next Engine Skill

## 概要
ネクストエンジンのEC運用における設定作業を自動化するスキルです。

## 対象システム
- **サービス名**: ネクストエンジン (Next Engine)
- **API仕様**: [Next Engine Developer Network](https://developer.next-engine.com/)
- **対応バージョン**: 2025年版API（商品コード連携対応）

## 自動化対象

### 1. 商品マスタ設定
- 商品登録・更新
- カテゴリ設定
- 商品コード連携（楽天/Amazon/Qoo10/Yahoo統合）
- 一括更新処理

### 2. 在庫管理設定
- 在庫数更新
- 在庫連携設定
- 在庫アラート設定
- 倉庫別在庫管理

### 3. 発送・配送設定
- 配送業者設定
- 配送方法マッピング
- 送り状発行設定
- 追跡番号登録

## 利用可能コマンド

| コマンド | 説明 |
|---------|------|
| `/user:next-engine-sync` | 商品マスタ同期 |
| `/user:next-engine-inventory` | 在庫更新 |
| `/user:next-engine-shipping` | 配送設定 |
| `/user:next-engine-setup` | 初期セットアップ |

## 設定ファイル

### API認証情報（環境変数）
```bash
NEXT_ENGINE_CLIENT_ID=your_client_id
NEXT_ENGINE_CLIENT_SECRET=your_client_secret
NEXT_ENGINE_REDIRECT_URI=your_redirect_uri
NEXT_ENGINE_ACCESS_TOKEN=your_access_token
NEXT_ENGINE_REFRESH_TOKEN=your_refresh_token
```

### 商品マスタ設定 (product-config.yaml)
```yaml
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
  options:
    update_mode: upsert
    batch_size: 100
    dry_run: false
```

### 在庫設定 (inventory-config.yaml)
```yaml
inventory:
  mode: unified  # unified or mall_specific
  sync:
    schedule: "*/10 * * * *"
    warehouses:
      - warehouse_id: "WH001"
        name: "東京倉庫"
  alerts:
    low_stock_threshold: 10
```

### 配送設定 (shipping-config.yaml)
```yaml
shipping:
  carriers:
    - carrier_id: "yamato"
      name: "ヤマト運輸"
    - carrier_id: "sagawa"
      name: "佐川急便"
  automation:
    auto_issue_slip: true
    auto_register_tracking: true
```

## 対応モール

| モール | 商品コード体系 | 在庫管理 |
|--------|--------------|---------|
| 楽天市場 | 商品管理番号 | モール別/統合 |
| Amazon | ASIN + SKU | FBA/自社出荷 |
| Qoo10 | Qoo10商品番号 | モール別/統合 |
| Yahoo!ショッピング | プロダクトID | モール別/統合 |

## 商品コード統一

マルチモール運用時は、マスター商品コードで統一管理：

```yaml
master_products:
  - master_code: "MASTER-001"
    internal_sku: "SKU-TSHIRT-BLK-M"
    jan_code: "4901234567890"
    mall_mappings:
      rakuten:
        product_code: "rakuten-prod-001"
      amazon:
        asin: "B08XXXXX"
        seller_sku: "seller-sku-001"
      qoo10:
        product_number: "12345678"
      yahoo:
        product_id: "yahoo-prod-001"
```

## API エンドポイント

| 機能 | エンドポイント |
|------|--------------|
| 商品検索 | `receiveorder/product/search` |
| 商品更新 | `receiveorder/product/update` |
| 在庫検索 | `receiveorder/stock/search` |
| 在庫更新 | `receiveorder/stock/update` |
| 受注検索 | `receiveorder/receiveorder/search` |
| 受注更新 | `receiveorder/receiveorder/update` |

## セキュリティ

- API キーは環境変数で管理
- アクセストークンの自動リフレッシュ
- 機密データのログ出力禁止
- 通信は HTTPS のみ

## 参考資料

- [Next Engine Developer Network](https://developer.next-engine.com/)
- [Next Engine API エンドポイント一覧](https://developer.next-engine.com/api)
- 設計書: `next-engine-skill-design.md`
