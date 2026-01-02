# ネクストエンジン設定自動化スキル 設計書

## 1. 概要

### 目的
ネクストエンジンのEC運用における設定作業を自動化し、効率化を図る。

### 対象システム
- **サービス名**: ネクストエンジン (Next Engine)
- **API仕様**: [Next Engine Developer Network](https://developer.next-engine.com/)
- **対応バージョン**: 2025年版API（商品コード連携対応）

### 自動化対象
1. **商品マスタ設定**
   - 商品登録・更新
   - カテゴリ設定
   - 商品コード連携
   - 一括更新処理

2. **在庫管理設定**
   - 在庫数更新
   - 在庫連携設定
   - 在庫アラート設定
   - 倉庫別在庫管理

3. **発送・配送設定**
   - 配送業者設定
   - 配送方法マッピング
   - 送り状発行設定
   - 追跡番号登録

---

## 2. 既存モール運用環境の考慮事項

### 2.1 前提条件

本スキルは、以下のECモールで**既に運用中**の店舗がネクストエンジンを導入する場合を想定しています：

| モール | 商品管理システム | 商品コード体系 | 在庫管理 |
|--------|---------------|--------------|---------|
| **楽天市場** | RMS (Rakuten Merchant Server) | 商品管理番号（任意設定） | モール別在庫 |
| **Amazon** | セラーセントラル | ASIN + SKU | FBA/自社出荷 |
| **Qoo10** | Qoo10 Seller Office | Qoo10商品番号 | モール別在庫 |
| **Yahoo!ショッピング** | ストアクリエイターPro | プロダクトID | モール別在庫 |

### 2.2 主要な課題と対策

#### 2.2.1 商品コード統一の課題

**課題:**
各モールで異なる商品コード体系が使用されており、ネクストエンジンでの統合管理が困難。

**例:**
```
同一商品が以下のように管理されている：
- 楽天: rakuten-prod-001
- Amazon: B08XXXXX (ASIN), seller-sku-001 (SKU)
- Qoo10: 12345678
- Yahoo: yahoo-prod-001
- 社内管理コード: MASTER-001
```

**対策:**

1. **マスター商品コード体系の設計**
   ```yaml
   # product-mapping.yaml
   master_products:
     - master_code: "MASTER-001"           # ネクストエンジン統一コード
       internal_sku: "SKU-TSHIRT-BLK-M"    # 社内SKU
       jan_code: "4901234567890"           # JANコード（あれば）

       # モール別商品コード
       mall_mappings:
         rakuten:
           product_code: "rakuten-prod-001"
           variant_code: "rakuten-var-001"
         amazon:
           asin: "B08XXXXX"
           seller_sku: "seller-sku-001"
         qoo10:
           product_number: "12345678"
           seller_code: "qoo10-sku-001"
         yahoo:
           product_id: "yahoo-prod-001"
   ```

2. **商品コードマッピングテーブルの構築**
   ```typescript
   // src/services/product-mapping-service.ts

   interface ProductMapping {
     masterCode: string;          // ネクストエンジン統一コード
     internalSku: string;         // 社内SKU
     janCode?: string;            // JANコード
     mallMappings: {
       rakuten?: {
         productCode: string;
         variantCode?: string;
       };
       amazon?: {
         asin: string;
         sellerSku: string;
       };
       qoo10?: {
         productNumber: string;
         sellerCode?: string;
       };
       yahoo?: {
         productId: string;
       };
     };
   }

   class ProductMappingService {
     // モール商品コードからマスター商品コードへの変換
     async getMasterCode(
       mall: 'rakuten' | 'amazon' | 'qoo10' | 'yahoo',
       mallProductCode: string
     ): Promise<string | null> {
       // マッピングテーブルから検索
     }

     // マスター商品コードから各モールの商品コードを取得
     async getMallCodes(masterCode: string): Promise<MallCodes> {
       // マッピングテーブルから取得
     }
   }
   ```

#### 2.2.2 商品情報の差異管理

**課題:**
各モールで商品名、説明文、価格、画像が異なる場合がある。

**具体例:**
| 項目 | 楽天 | Amazon | Qoo10 | Yahoo |
|------|------|--------|-------|-------|
| 商品名 | 【送料無料】メンズTシャツ 黒 Mサイズ | メンズTシャツ ブラック M | Men's T-Shirt Black M | メンズTシャツ（黒・M） |
| 価格 | 2,980円 | 2,780円 | 2,680円 | 2,880円 |
| 説明文 | 楽天限定セット内容を含む | Amazon向け簡潔版 | 韓国語混在 | Yahoo向け |

**対策:**

1. **モール別商品属性の管理**
   ```yaml
   # product-config.yaml
   products:
     source:
       type: csv
       path: ./data/products-multi-mall.csv

     # モール別属性マッピング
     mall_specific_attributes:
       enabled: true

       # 共通属性（ネクストエンジンマスター）
       common:
         - master_code
         - internal_sku
         - jan_code
         - base_price
         - stock

       # モール固有属性
       rakuten:
         - rakuten_product_name      # 楽天商品名
         - rakuten_price             # 楽天価格
         - rakuten_description       # 楽天説明文
         - rakuten_image_urls        # 楽天画像URL
         - rakuten_category_id       # 楽天カテゴリID

       amazon:
         - amazon_title              # Amazon商品タイトル
         - amazon_price              # Amazon価格
         - amazon_bullet_points      # Amazon箇条書き
         - amazon_product_type       # Amazonプロダクトタイプ

       qoo10:
         - qoo10_title              # Qoo10タイトル
         - qoo10_price              # Qoo10価格
         - qoo10_description_kr     # 韓国語説明

       yahoo:
         - yahoo_name               # Yahoo商品名
         - yahoo_price              # Yahoo価格
         - yahoo_description        # Yahoo説明文
   ```

2. **データ統合処理**
   ```typescript
   // src/processors/mall-data-integrator.ts

   interface MallProductData {
     masterCode: string;

     // 共通属性
     common: {
       internalSku: string;
       janCode?: string;
       basePrice: number;
       stock: number;
     };

     // モール別属性
     mallSpecific: {
       rakuten?: RakutenProductAttributes;
       amazon?: AmazonProductAttributes;
       qoo10?: Qoo10ProductAttributes;
       yahoo?: YahooProductAttributes;
     };
   }

   class MallDataIntegrator {
     // 各モールのデータを統合
     async integrateProductData(
       masterCode: string
     ): Promise<MallProductData> {
       const rakutenData = await this.fetchRakutenData(masterCode);
       const amazonData = await this.fetchAmazonData(masterCode);
       const qoo10Data = await this.fetchQoo10Data(masterCode);
       const yahooData = await this.fetchYahooData(masterCode);

       return {
         masterCode,
         common: this.extractCommonAttributes([
           rakutenData,
           amazonData,
           qoo10Data,
           yahooData,
         ]),
         mallSpecific: {
           rakuten: rakutenData,
           amazon: amazonData,
           qoo10: qoo10Data,
           yahoo: yahooData,
         },
       };
     }

     // 共通属性の抽出（優先順位ルールに基づく）
     private extractCommonAttributes(
       mallDataList: MallProductData[]
     ): CommonAttributes {
       // 優先順位: Amazon > 楽天 > Yahoo > Qoo10
       // または、最高価格、最低価格などのルールを適用
     }
   }
   ```

#### 2.2.3 在庫管理の複雑性

**課題:**
- モール別在庫 vs 統合在庫の選択
- 在庫引当ルールの設定
- 安全在庫の確保

**在庫管理パターン:**

**パターン1: モール別在庫管理**
```yaml
inventory:
  mode: mall_specific

  allocation:
    master_code: "MASTER-001"
    total_stock: 100

    # モール別割り当て
    mall_allocation:
      rakuten: 30
      amazon: 40
      qoo10: 15
      yahoo: 15

    # 在庫調整ルール
    rules:
      auto_rebalance: true           # 売れ行きに応じて自動再配分
      rebalance_interval: daily      # 再配分頻度
      safety_stock: 5                # 安全在庫数
```

**パターン2: 統合在庫管理**
```yaml
inventory:
  mode: unified

  allocation:
    master_code: "MASTER-001"
    total_stock: 100

    # 統合在庫から自動引当
    rules:
      priority_order:                # 優先順位
        - amazon                     # Amazon優先（利益率高い）
        - rakuten
        - yahoo
        - qoo10

      buffer_stock: 10               # バッファ在庫
      oversell_protection: true      # 売り越し防止
      sync_interval_minutes: 5       # 同期間隔
```

**実装例:**
```typescript
// src/services/inventory-allocation-service.ts

type AllocationMode = 'mall_specific' | 'unified';

interface InventoryAllocation {
  masterCode: string;
  totalStock: number;
  mode: AllocationMode;
  mallAllocation?: Record<string, number>;
  rules: AllocationRules;
}

class InventoryAllocationService {
  // 在庫を各モールに配分
  async allocateStock(
    allocation: InventoryAllocation
  ): Promise<void> {
    if (allocation.mode === 'mall_specific') {
      await this.allocateMallSpecific(allocation);
    } else {
      await this.allocateUnified(allocation);
    }
  }

  // モール別在庫配分
  private async allocateMallSpecific(
    allocation: InventoryAllocation
  ): Promise<void> {
    for (const [mall, stock] of Object.entries(
      allocation.mallAllocation!
    )) {
      await this.updateMallStock(
        allocation.masterCode,
        mall,
        stock
      );
    }
  }

  // 統合在庫管理（優先順位ベース）
  private async allocateUnified(
    allocation: InventoryAllocation
  ): Promise<void> {
    const availableStock = allocation.totalStock;

    // ネクストエンジンで一元管理
    await this.nextEngineClient.updateStock({
      masterCode: allocation.masterCode,
      stock: availableStock,
      syncToMalls: true,  // 各モールに自動同期
    });
  }

  // 在庫再配分（売れ行きベース）
  async rebalanceStock(masterCode: string): Promise<void> {
    // 各モールの売上データを取得
    const salesData = await this.getSalesData(masterCode);

    // 売上比率に基づいて在庫を再配分
    const newAllocation = this.calculateOptimalAllocation(
      salesData
    );

    await this.allocateStock(newAllocation);
  }
}
```

#### 2.2.4 データ移行戦略

**課題:**
既存モールの膨大な商品データをネクストエンジンに移行する際の戦略。

**移行アプローチ:**

**アプローチ1: 段階的移行（推奨）**
```yaml
migration:
  strategy: phased

  phases:
    # Phase 1: パイロット商品（10-20商品）
    - phase: 1
      name: "Pilot Migration"
      target_products: 20
      criteria:
        - high_volume_sellers: true
        - simple_variants: true
      duration_days: 7
      validation:
        - data_accuracy_check
        - order_flow_test
        - inventory_sync_test

    # Phase 2: カテゴリ別移行（100-200商品）
    - phase: 2
      name: "Category Migration"
      target_categories:
        - "アパレル"
        - "雑貨"
      duration_days: 14
      parallel_run: true    # 既存システムと並行稼働

    # Phase 3: 全商品移行
    - phase: 3
      name: "Full Migration"
      target_products: all
      duration_days: 30
      cutover_plan:
        - backup_existing_data
        - execute_migration
        - validate_data
        - switch_to_next_engine
```

**アプローチ2: 一括移行**
```yaml
migration:
  strategy: big_bang

  preparation:
    # 事前準備期間
    - data_cleansing: 30 days
    - mapping_table_creation: 14 days
    - test_migration: 7 days

  execution:
    cutover_date: "2026-02-01"
    cutover_window:
      start: "2026-02-01 00:00:00"
      end: "2026-02-01 06:00:00"

    steps:
      - freeze_mall_orders        # 受注停止
      - export_all_data           # データ一括エクスポート
      - import_to_next_engine     # ネクストエンジンへ投入
      - validate_data             # データ検証
      - resume_operations         # 運用再開

  rollback_plan:
    trigger_conditions:
      - data_loss_detected
      - critical_errors > 5%
    procedures:
      - restore_from_backup
      - revert_to_mall_systems
```

**移行スクリプト:**
```typescript
// scripts/migration/migrate-from-malls.ts

interface MigrationConfig {
  strategy: 'phased' | 'big_bang';
  sourceData: {
    rakuten: string;    // CSVパス
    amazon: string;
    qoo10: string;
    yahoo: string;
  };
  mappingTable: string; // マッピングテーブル
  validation: {
    enableDryRun: boolean;
    sampleSize?: number;
  };
}

class MallMigrationService {
  async executeMigration(
    config: MigrationConfig
  ): Promise<MigrationResult> {
    // 1. データ収集
    const allMallData = await this.collectMallData(config);

    // 2. データクレンジング
    const cleanedData = await this.cleanseData(allMallData);

    // 3. 商品コード統一
    const unifiedData = await this.unifyProductCodes(
      cleanedData,
      config.mappingTable
    );

    // 4. 重複排除
    const deduplicatedData = await this.deduplicateProducts(
      unifiedData
    );

    // 5. バリデーション
    const validationResult = await this.validateMigrationData(
      deduplicatedData
    );

    if (!validationResult.isValid) {
      throw new Error('Migration data validation failed');
    }

    // 6. Dry Run（設定されている場合）
    if (config.validation.enableDryRun) {
      return await this.executeDryRun(deduplicatedData);
    }

    // 7. 本番移行実行
    return await this.executeProductionMigration(
      deduplicatedData
    );
  }

  // モールデータの収集
  private async collectMallData(
    config: MigrationConfig
  ): Promise<MallData[]> {
    const loaders = {
      rakuten: new RakutenDataLoader(config.sourceData.rakuten),
      amazon: new AmazonDataLoader(config.sourceData.amazon),
      qoo10: new Qoo10DataLoader(config.sourceData.qoo10),
      yahoo: new YahooDataLoader(config.sourceData.yahoo),
    };

    const [rakutenData, amazonData, qoo10Data, yahooData] =
      await Promise.all([
        loaders.rakuten.load(),
        loaders.amazon.load(),
        loaders.qoo10.load(),
        loaders.yahoo.load(),
      ]);

    return [...rakutenData, ...amazonData, ...qoo10Data, ...yahooData];
  }
}
```

#### 2.2.5 モール固有制約への対応

**楽天市場**
```yaml
rakuten:
  constraints:
    # RMS制約
    - max_product_name_length: 255
    - max_description_length: 10000
    - required_fields:
        - item_number
        - item_name
        - price
        - inventory

    # カテゴリ階層
    category_hierarchy:
      max_depth: 4
      mapping_required: true

  api_integration:
    # RMS WebService API
    endpoint: "https://api.rms.rakuten.co.jp/"
    auth_method: "license_key"
    rate_limit: 5000 per_day
```

**Amazon**
```yaml
amazon:
  constraints:
    # セラーセントラル制約
    - asin_required: true
    - sku_max_length: 40
    - product_type_required: true

    # FBA対応
    fba_integration:
      enabled: true
      sync_fba_inventory: true

  api_integration:
    # MWS / SP-API
    endpoint: "https://sellingpartnerapi-fe.amazon.com"
    auth_method: "lwa_oauth2"
    marketplace_id: "A1VC38T7YXB528"  # 日本
```

**Qoo10**
```yaml
qoo10:
  constraints:
    # Qoo10固有制約
    - product_number_format: numeric
    - multilingual_support:
        - japanese
        - korean
        - english

    # 配送オプション
    shipping:
      qxpress_required: true
      overseas_shipping: supported

  api_integration:
    endpoint: "https://api.qoo10.jp/GMKT.INC.Front.QAPIService/"
    auth_method: "api_key"
```

**Yahoo!ショッピング**
```yaml
yahoo:
  constraints:
    # ストアクリエイターPro制約
    - product_id_max_length: 50
    - category_mapping_required: true
    - yahoo_wallet_integration: required

    # PRO契約限定機能
    pro_features:
      - advanced_analytics
      - api_integration

  api_integration:
    endpoint: "https://circus.shopping.yahooapis.jp/"
    auth_method: "yahoo_id"
```

### 2.3 推奨データフロー

```
[既存モール] → [データ抽出] → [データクレンジング] → [商品コード統一]
                                                            ↓
                                                    [マッピングテーブル]
                                                            ↓
                                    [ネクストエンジン商品マスター] ← [バリデーション]
                                                            ↓
                        ┌──────────────┬──────────────┬──────────────┬──────────────┐
                        ↓              ↓              ↓              ↓              ↓
                    [楽天市場]      [Amazon]       [Qoo10]    [Yahoo!ショッピング]
                        ↓              ↓              ↓              ↓
                    [在庫同期] ←───── [ネクストエンジン在庫管理] ─────→ [在庫同期]
```

---

## 3. アーキテクチャ設計

### 2.1 全体構成

```
~/.claude/skills/next-engine/
├── SKILL.md                    # スキル定義（メインファイル）
├── commands/                   # 実行可能コマンド
│   ├── sync-products.sh        # 商品マスタ同期
│   ├── update-inventory.sh     # 在庫更新
│   └── configure-shipping.sh   # 配送設定
├── templates/                  # 設定ファイルテンプレート
│   ├── product-config.yaml
│   ├── inventory-config.yaml
│   └── shipping-config.yaml
├── scripts/                    # 実装スクリプト
│   ├── api-client.ts           # Next Engine API クライアント
│   ├── product-sync.ts         # 商品同期処理
│   ├── inventory-sync.ts       # 在庫同期処理
│   └── shipping-sync.ts        # 配送設定同期
└── lib/
    ├── auth.ts                 # 認証処理
    ├── validators.ts           # バリデーション
    └── error-handler.ts        # エラーハンドリング
```

### 2.2 実行フロー

```
ユーザーコマンド実行
    ↓
設定ファイル読み込み (YAML/JSON)
    ↓
バリデーション
    ↓
Next Engine API認証
    ↓
API呼び出し（バッチ処理）
    ↓
結果レポート生成
```

---

## 3. 設定ファイル仕様

### 3.1 商品マスタ設定 (`product-config.yaml`)

```yaml
# Next Engine API認証情報
api:
  client_id: "${NEXT_ENGINE_CLIENT_ID}"
  client_secret: "${NEXT_ENGINE_CLIENT_SECRET}"
  redirect_uri: "${NEXT_ENGINE_REDIRECT_URI}"
  access_token: "${NEXT_ENGINE_ACCESS_TOKEN}"
  refresh_token: "${NEXT_ENGINE_REFRESH_TOKEN}"

# 商品マスタ設定
products:
  # データソース（CSV, JSON, DB など）
  source:
    type: csv
    path: ./data/products.csv
    encoding: utf-8

  # マッピング定義
  mapping:
    product_code: "商品コード"
    product_name: "商品名"
    price: "販売価格"
    stock: "在庫数"
    category: "カテゴリ"
    description: "商品説明"

  # 更新オプション
  options:
    update_mode: upsert  # create, update, upsert
    batch_size: 100
    error_handling: skip  # skip, stop, rollback
    dry_run: false

# ログ設定
logging:
  level: info
  output: ./logs/product-sync.log
```

### 3.2 在庫管理設定 (`inventory-config.yaml`)

```yaml
api:
  client_id: "${NEXT_ENGINE_CLIENT_ID}"
  client_secret: "${NEXT_ENGINE_CLIENT_SECRET}"
  access_token: "${NEXT_ENGINE_ACCESS_TOKEN}"

inventory:
  source:
    type: api  # api, csv, json
    endpoint: "https://your-warehouse-api.com/inventory"
    headers:
      Authorization: "Bearer ${WAREHOUSE_API_TOKEN}"

  # 在庫同期設定
  sync:
    schedule: "*/10 * * * *"  # 10分ごと
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

### 3.3 発送・配送設定 (`shipping-config.yaml`)

```yaml
api:
  client_id: "${NEXT_ENGINE_CLIENT_ID}"
  client_secret: "${NEXT_ENGINE_CLIENT_SECRET}"
  access_token: "${NEXT_ENGINE_ACCESS_TOKEN}"

shipping:
  # 配送業者マッピング
  carriers:
    - carrier_id: "yamato"
      name: "ヤマト運輸"
      api_key: "${YAMATO_API_KEY}"
      tracking_url: "https://toi.kuronekoyamato.co.jp/cgi-bin/tneko"
    - carrier_id: "sagawa"
      name: "佐川急便"
      api_key: "${SAGAWA_API_KEY}"
      tracking_url: "https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do"

  # 配送方法マッピング
  shipping_methods:
    - next_engine_id: "001"
      carrier_id: "yamato"
      service_type: "宅急便"
      default_size: "60"
    - next_engine_id: "002"
      carrier_id: "yamato"
      service_type: "ネコポス"

  # 自動処理設定
  automation:
    auto_issue_slip: true
    auto_register_tracking: true
    notification_on_shipped: true
```

---

## 4. API クライアント設計

### 4.1 認証フロー

```typescript
// scripts/api-client.ts

interface NextEngineAuth {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  access_token?: string;
  refresh_token?: string;
}

class NextEngineClient {
  private auth: NextEngineAuth;
  private baseUrl = 'https://api.next-engine.org/api_v1_';

  constructor(auth: NextEngineAuth) {
    this.auth = auth;
  }

  // OAuth認証
  async authenticate(): Promise<void> {
    // アクセストークン取得・リフレッシュ処理
  }

  // APIリクエスト共通処理
  async request(endpoint: string, params?: Record<string, any>): Promise<any> {
    // レート制限対応
    // エラーハンドリング
    // リトライ処理
  }
}
```

### 4.2 主要エンドポイント

| 機能 | エンドポイント | 用途 |
|------|--------------|------|
| 商品検索 | `receiveorder/product/search` | 商品情報取得 |
| 商品更新 | `receiveorder/product/update` | 商品情報更新 |
| 在庫検索 | `receiveorder/stock/search` | 在庫情報取得 |
| 在庫更新 | `receiveorder/stock/update` | 在庫数更新 |
| 受注検索 | `receiveorder/receiveorder/search` | 受注情報取得 |
| 受注更新 | `receiveorder/receiveorder/update` | 受注情報更新 |

---

## 5. エラーハンドリング

### 5.1 エラー分類

```typescript
// lib/error-handler.ts

export class NextEngineError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }
}

// API認証エラー
export class AuthenticationError extends NextEngineError {
  constructor(message = 'Authentication failed') {
    super(message, 'AUTH_ERROR', 401);
  }
}

// レート制限エラー
export class RateLimitError extends NextEngineError {
  constructor(retryAfter?: number) {
    super('Rate limit exceeded', 'RATE_LIMIT', 429, { retryAfter });
  }
}

// バリデーションエラー
export class ValidationError extends NextEngineError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

// API エラー
export class ApiError extends NextEngineError {
  constructor(message: string, statusCode: number, details?: Record<string, unknown>) {
    super(message, 'API_ERROR', statusCode, details);
  }
}
```

### 5.2 リトライ戦略

```typescript
// lib/retry.ts

interface RetryOptions {
  maxRetries: number;
  backoffMs: number;
  maxBackoffMs: number;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {
    maxRetries: 3,
    backoffMs: 1000,
    maxBackoffMs: 10000,
  }
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // リトライ可能なエラーかチェック
      if (!isRetryable(error)) {
        throw error;
      }

      // 最後の試行ならエラーをスロー
      if (attempt === options.maxRetries) {
        break;
      }

      // バックオフ待機
      const backoff = Math.min(
        options.backoffMs * Math.pow(2, attempt),
        options.maxBackoffMs
      );
      await sleep(backoff);
    }
  }

  throw lastError!;
}
```

---

## 6. バリデーション

### 6.1 設定ファイルバリデーション

```typescript
// lib/validators.ts
import { z } from 'zod';

// API認証スキーマ
const apiAuthSchema = z.object({
  client_id: z.string().min(1, 'Client ID is required'),
  client_secret: z.string().min(1, 'Client Secret is required'),
  redirect_uri: z.string().url('Invalid redirect URI'),
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
});

// 商品設定スキーマ
const productConfigSchema = z.object({
  api: apiAuthSchema,
  products: z.object({
    source: z.object({
      type: z.enum(['csv', 'json', 'db']),
      path: z.string(),
      encoding: z.string().default('utf-8'),
    }),
    mapping: z.record(z.string()),
    options: z.object({
      update_mode: z.enum(['create', 'update', 'upsert']),
      batch_size: z.number().int().positive().max(1000),
      error_handling: z.enum(['skip', 'stop', 'rollback']),
      dry_run: z.boolean().default(false),
    }),
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    output: z.string(),
  }).optional(),
});

export type ProductConfig = z.infer<typeof productConfigSchema>;

export function validateProductConfig(config: unknown): ProductConfig {
  return productConfigSchema.parse(config);
}
```

---

## 7. 実行コマンド設計

### 7.1 商品マスタ同期コマンド

```bash
# ~/.claude/skills/next-engine/commands/sync-products.sh

#!/bin/bash

# 使用方法:
# /user:next-engine:sync-products [config-file]

CONFIG_FILE=${1:-"./product-config.yaml"}

echo "🚀 Next Engine 商品マスタ同期開始"
echo "設定ファイル: $CONFIG_FILE"

# TypeScriptスクリプト実行
npx tsx ~/.claude/skills/next-engine/scripts/product-sync.ts \
  --config "$CONFIG_FILE" \
  --verbose

echo "✅ 同期完了"
```

### 7.2 在庫更新コマンド

```bash
# ~/.claude/skills/next-engine/commands/update-inventory.sh

#!/bin/bash

CONFIG_FILE=${1:-"./inventory-config.yaml"}

echo "📦 Next Engine 在庫更新開始"
echo "設定ファイル: $CONFIG_FILE"

npx tsx ~/.claude/skills/next-engine/scripts/inventory-sync.ts \
  --config "$CONFIG_FILE" \
  --verbose

echo "✅ 在庫更新完了"
```

### 7.3 配送設定コマンド

```bash
# ~/.claude/skills/next-engine/commands/configure-shipping.sh

#!/bin/bash

CONFIG_FILE=${1:-"./shipping-config.yaml"}

echo "🚚 Next Engine 配送設定開始"
echo "設定ファイル: $CONFIG_FILE"

npx tsx ~/.claude/skills/next-engine/scripts/shipping-sync.ts \
  --config "$CONFIG_FILE" \
  --verbose

echo "✅ 配送設定完了"
```

---

## 8. 実装優先順位

### Phase 1: 基盤構築（Week 1-2）
- [ ] API クライアント実装
- [ ] 認証フロー実装
- [ ] エラーハンドリング実装
- [ ] バリデーション実装
- [ ] ロギング実装

### Phase 2: 商品マスタ自動化（Week 3）
- [ ] 商品データ読み込み
- [ ] 商品マッピング処理
- [ ] 商品検索API実装
- [ ] 商品更新API実装
- [ ] バッチ処理実装

### Phase 3: 在庫管理自動化（Week 4）
- [ ] 在庫データソース連携
- [ ] 在庫検索API実装
- [ ] 在庫更新API実装
- [ ] アラート機能実装

### Phase 4: 発送・配送自動化（Week 5）
- [ ] 配送業者API連携
- [ ] 送り状発行機能
- [ ] 追跡番号登録機能
- [ ] 通知機能実装

### Phase 5: テスト・ドキュメント（Week 6）
- [ ] 単体テスト作成
- [ ] 統合テスト実行
- [ ] ドキュメント整備
- [ ] 運用マニュアル作成

---

## 9. セキュリティ考慮事項

### 9.1 認証情報管理
- API キーは環境変数で管理
- `.env` ファイルを `.gitignore` に追加
- アクセストークンの自動リフレッシュ実装

### 9.2 データ保護
- 機密データのログ出力禁止
- 通信は HTTPS のみ
- 個人情報の暗号化

### 9.3 権限管理
- 最小権限の原則
- API アクセス権限の定期レビュー
- 監査ログの記録

---

## 10. モニタリング・ログ

### 10.1 ログ出力仕様

```typescript
// lib/logger.ts

enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

class Logger {
  constructor(private config: { level: LogLevel; output: string }) {}

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
    };

    // ファイル出力 or コンソール出力
    this.write(entry);
  }
}
```

### 10.2 実行レポート

実行後に以下の情報を含むレポートを生成：

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

## 11. テスト戦略

### 11.1 単体テスト

```typescript
// scripts/__tests__/api-client.test.ts
import { describe, it, expect, vi } from 'vitest';
import { NextEngineClient } from '../api-client';

describe('NextEngineClient', () => {
  it('should authenticate successfully', async () => {
    const client = new NextEngineClient({
      client_id: 'test_id',
      client_secret: 'test_secret',
      redirect_uri: 'https://example.com/callback',
    });

    // モック実装
    const mockAuth = vi.spyOn(client, 'authenticate');
    mockAuth.mockResolvedValue();

    await client.authenticate();

    expect(mockAuth).toHaveBeenCalled();
  });

  it('should handle rate limiting', async () => {
    // レート制限のテスト
  });
});
```

### 11.2 統合テスト

```typescript
// scripts/__tests__/integration/product-sync.test.ts
describe('Product Sync Integration', () => {
  it('should sync products from CSV to Next Engine', async () => {
    // E2Eテスト（サンドボックス環境使用）
  });
});
```

---

## 12. パフォーマンス最適化

### 12.1 バッチ処理
- API リクエストを適切なサイズにバッチング（100-200件）
- 並列実行数の制限（同時5リクエストまで）
- プログレスバー表示

### 12.2 キャッシング
- アクセストークンのメモリキャッシュ
- マスタデータの一時キャッシュ
- レート制限情報の保持

### 12.3 レート制限対応
- API制限: 1分あたり60リクエスト
- 指数バックオフによるリトライ
- レート制限エラー時の待機処理

---

## 13. ドキュメント

### 必要なドキュメント
1. **SKILL.md** - スキル定義と使用方法
2. **API_REFERENCE.md** - API リファレンス
3. **CONFIG_GUIDE.md** - 設定ファイルガイド
4. **TROUBLESHOOTING.md** - トラブルシューティング
5. **CHANGELOG.md** - 変更履歴

---

## 14. 参考資料

- [Next Engine Developer Network](https://developer.next-engine.com/)
- [Next Engine API エンドポイント一覧](https://developer.next-engine.com/api)
- [Next Engine API 仕様（ストッククルー）](https://knowledge.stockcrew.co.jp/help/apialignment/next-engine/attention)
- [ロジクラ - Next Engine API 徹底解説](https://logikura.jp/columns/thorough-explanation-of-next-engine-api/)

---

**作成日**: 2026-01-02
**作成者**: Claude Code
**バージョン**: 1.0.0
