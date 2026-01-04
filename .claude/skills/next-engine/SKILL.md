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

## APIアクセス数最小化のベストプラクティス

**重要**: Next Engine APIは月1000回の無料枠があるため、APIコール数を最小化することが極めて重要です。

### 基本原則

1. **1回のAPIコールで最大限のデータを取得する**
2. **不要なAPIコールを避ける（キャッシュ活用）**
3. **差分のみを取得・更新する**
4. **バッチ処理を活用する**

### 1. ページネーション設定の最適化

Next Engine APIはページネーションをサポートしています。**必ず最大ページサイズを使用してください。**

#### 推奨設定

```typescript
// ❌ 悪い例: デフォルト設定（ページサイズ小）
const params = {
  limit: 10  // 100件取得に10回APIコール必要
};

// ✅ 良い例: 最大ページサイズ
const params = {
  limit: 1000  // Next Engineの最大値（1回で1000件取得）
};
```

#### 実装例

```typescript
async function fetchAllProducts() {
  const allProducts = [];
  let offset = 0;
  const LIMIT = 1000;  // 最大ページサイズ

  while (true) {
    // 1回のAPIコールで最大1000件取得
    const response = await api.get('receiveorder/product/search', {
      limit: LIMIT,
      offset: offset
    });

    await recordApiCall('receiveorder/product/search', true);

    allProducts.push(...response.data);

    // 取得件数が1000件未満なら終了
    if (response.data.length < LIMIT) {
      break;
    }

    offset += LIMIT;
  }

  return allProducts;
}
```

### 2. カラム指定の戦略

Next Engine APIは取得するカラムを指定できます。**必要なカラムが不明な場合は、全カラムを取得してください。**

#### 理由

- 後で追加のカラムが必要になった場合、再度APIコールが必要
- 1回のAPIコールで全データを取得する方が効率的

#### 推奨設定

```typescript
// ❌ 悪い例: 最小限のカラムのみ（後で不足して再取得が必要）
const params = {
  fields: 'product_id,product_name'  // 価格が必要になったら再度APIコール
};

// ✅ 良い例: 全カラムを取得
const params = {
  fields: '*'  // または全カラムをリスト化
  // fields: 'product_id,product_name,price,stock,jan_code,category,...'
};
```

#### 全カラム取得の実装例

```typescript
// 商品マスタの全カラム
const ALL_PRODUCT_FIELDS = [
  'product_id',
  'product_code',
  'product_name',
  'price',
  'stock_quantity',
  'jan_code',
  'category_id',
  'category_name',
  'mall_product_code',
  'mall_id',
  'image_url',
  'description',
  'weight',
  'size',
  'manufacturer',
  'brand',
  'creation_date',
  'update_date',
  'status',
  'tags'
].join(',');

const params = {
  fields: ALL_PRODUCT_FIELDS,
  limit: 1000
};
```

### 3. キャッシュ戦略

頻繁に変更されないデータ（カテゴリマスタ、配送業者マスタなど）はキャッシュを活用します。

#### キャッシュ設定

```yaml
# product-config.yaml に追加
cache:
  enabled: true

  # カテゴリマスタ（めったに変更されない）
  categories:
    ttl: 86400  # 24時間キャッシュ
    file: ./cache/categories.json

  # 配送業者マスタ
  carriers:
    ttl: 86400  # 24時間キャッシュ
    file: ./cache/carriers.json

  # 商品マスタ（頻繁に変更される）
  products:
    ttl: 3600  # 1時間キャッシュ
    file: ./cache/products.json
```

#### 実装例

```typescript
async function getCategoriesWithCache() {
  const cacheFile = './cache/categories.json';
  const cacheTTL = 86400 * 1000; // 24時間

  // キャッシュ確認
  if (fs.existsSync(cacheFile)) {
    const stats = fs.statSync(cacheFile);
    const age = Date.now() - stats.mtimeMs;

    if (age < cacheTTL) {
      console.log('✅ キャッシュから取得（APIコールなし）');
      return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    }
  }

  // キャッシュがない、または期限切れ → API呼び出し
  console.log('📡 APIから取得');
  const categories = await api.get('master/category/search', {
    fields: '*',
    limit: 1000
  });

  await recordApiCall('master/category/search', true);

  // キャッシュに保存
  fs.writeFileSync(cacheFile, JSON.stringify(categories, null, 2));

  return categories;
}
```

### 4. 差分取得・差分更新

#### 差分取得

既存データと比較して、変更があったデータのみを処理します。

```typescript
async function syncProductsWithDiff() {
  // 1. キャッシュから既存商品を取得（APIコールなし）
  const cachedProducts = loadFromCache('./cache/products.json');

  // 2. 最終更新日時以降のデータのみ取得
  const lastSyncDate = getLastSyncDate();
  const newProducts = await api.get('receiveorder/product/search', {
    fields: '*',
    limit: 1000,
    updated_date_from: lastSyncDate  // 差分のみ取得
  });

  await recordApiCall('receiveorder/product/search', true);

  // 3. 差分検出
  const diff = detectDiff(cachedProducts, newProducts);

  console.log(`新規: ${diff.new.length}件`);
  console.log(`更新: ${diff.updated.length}件`);
  console.log(`未変更: ${diff.unchanged.length}件（スキップ）`);

  return diff;
}
```

#### 差分更新（バルク更新）

```typescript
async function updateProductsBulk(products: Product[]) {
  const BATCH_SIZE = 100;  // Next Engineのバッチサイズ上限

  // 100件ずつバッチ更新
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    // 1回のAPIコールで100件更新
    await api.post('receiveorder/product/update', {
      products: batch
    });

    await recordApiCall('receiveorder/product/update', true);

    console.log(`✅ ${i + batch.length}/${products.length}件更新完了`);
  }
}
```

### 5. 検索条件の最適化

必要なデータのみを取得するように検索条件を最適化します。

```typescript
// ❌ 悪い例: 全件取得してからフィルタ
const allProducts = await fetchAllProducts();  // 5000件 → 50回APIコール
const activeProducts = allProducts.filter(p => p.status === 'active');

// ✅ 良い例: 検索条件で絞り込み
const activeProducts = await api.get('receiveorder/product/search', {
  fields: '*',
  limit: 1000,
  status: 'active'  // サーバー側でフィルタ
});
await recordApiCall('receiveorder/product/search', true);
```

### 6. 並列処理を避ける

複数のAPIコールが必要な場合でも、並列実行は避けてください（レート制限対策）。

```typescript
// ❌ 悪い例: 並列実行（レート制限エラーの可能性）
const [products, stocks, orders] = await Promise.all([
  fetchProducts(),
  fetchStocks(),
  fetchOrders()
]);

// ✅ 良い例: 順次実行
const products = await fetchProducts();
const stocks = await fetchStocks();
const orders = await fetchOrders();
```

### 7. 事前計算とAPI回数の見積もり

大量データを扱う場合、事前に必要なAPI回数を計算します。

```typescript
async function estimateApiCalls(totalItems: number): Promise<number> {
  const PAGE_SIZE = 1000;
  const BATCH_SIZE = 100;

  // 取得に必要なコール数
  const fetchCalls = Math.ceil(totalItems / PAGE_SIZE);

  // 更新に必要なコール数
  const updateCalls = Math.ceil(totalItems / BATCH_SIZE);

  const totalCalls = fetchCalls + updateCalls;

  console.log(`📊 予測API回数: ${totalCalls}回`);
  console.log(`  - 取得: ${fetchCalls}回`);
  console.log(`  - 更新: ${updateCalls}回`);

  // 残りAPI回数を確認
  const usage = loadApiUsage();
  if (usage.remaining < totalCalls) {
    throw new Error(
      `⚠️ API回数不足: 必要${totalCalls}回、残り${usage.remaining}回`
    );
  }

  return totalCalls;
}
```

### 8. 設定ファイルでの最適化

`api-config.yaml` に最適化設定を追加：

```yaml
optimization:
  # ページネーション設定
  pagination:
    default_limit: 1000  # 常に最大サイズを使用

  # カラム取得戦略
  fields:
    strategy: all  # all: 全カラム / minimal: 最小限

  # キャッシュ設定
  cache:
    enabled: true
    default_ttl: 3600  # 1時間

  # バッチ処理
  batch:
    size: 100  # Next Engineの上限
    parallel: false  # 並列処理を無効化
```

### 最適化チェックリスト

API実装時に以下を確認してください：

- [ ] ページサイズを1000（最大値）に設定
- [ ] 必要なカラムが不明な場合は全カラムを取得（`fields: '*'`）
- [ ] キャッシュ可能なデータはキャッシュを使用
- [ ] 差分取得・差分更新を活用
- [ ] バッチ処理でまとめて更新（100件ずつ）
- [ ] 検索条件で事前にフィルタリング
- [ ] 並列処理を避ける
- [ ] 事前にAPI回数を見積もる
- [ ] 不要なAPIコールがないか確認

## API使用量制限管理

Next Engine APIは月1000回までの無料枠があり、それを超えると課金が発生します。
**重要**: APIを使用する前に、必ず現在の使用状況を確認してください。

### 環境判定（テスト vs 本番）

**重要**: テスト環境でのAPIコールは料金に含まれません。本番環境のAPIコールのみがカウントされます。

#### 環境の自動検出

システムは以下の方法で環境を自動判定します：

1. **環境変数による判定** (`NEXT_ENGINE_ENV`)
   ```bash
   export NEXT_ENGINE_ENV=production  # 本番環境
   export NEXT_ENGINE_ENV=test       # テスト環境
   ```

2. **APIエンドポイントURLパターンによる判定**
   ```typescript
   // テスト環境: https://testapi.next-engine.com/...
   // 本番環境: https://api.next-engine.com/...
   ```

#### 環境別のカウント動作

```yaml
# api-config.yaml
environment:
  current: production  # デフォルト環境
  detection:
    env_var: NEXT_ENGINE_ENV
    test_api_pattern: "https://testapi.next-engine.*"
    production_api_pattern: "https://api.next-engine.*"
  count_test_calls: false  # テスト環境はカウントしない
```

#### 実装例

```typescript
function detectEnvironment(apiUrl: string): 'production' | 'test' {
  // 1. 環境変数を優先
  const envVar = process.env.NEXT_ENGINE_ENV;
  if (envVar === 'test' || envVar === 'production') {
    return envVar;
  }

  // 2. APIエンドポイントURLから判定
  if (apiUrl.includes('testapi.next-engine')) {
    return 'test';
  }

  // 3. デフォルトは本番環境
  return 'production';
}

async function recordApiCall(endpoint: string, success: boolean, apiUrl: string) {
  const env = detectEnvironment(apiUrl);
  const usage = loadApiUsage();

  // テスト環境のコールはカウントしない
  if (env === 'production') {
    usage.usage.total_calls++;
    usage.limits.remaining--;
  }

  // 環境別の統計は記録（分析用）
  usage.by_environment[env] = (usage.by_environment[env] || 0) + 1;

  console.log(`📊 環境: ${env}, カウント: ${env === 'production' ? 'あり' : 'なし'}`);

  saveApiUsage(usage);
}
```

### リモートAPI使用量管理（Cloudflare Workers）

API使用量の管理を **Cloudflare Workers** で一元管理します。これにより、ローカル環境やCI/CD環境など、複数の実行環境から同じAPI使用状況を参照・更新できます。

#### アーキテクチャ

```
┌─────────────┐         ┌──────────────────────┐         ┌──────────────┐
│ ローカル環境 │ ──────> │ Cloudflare Workers   │ ──────> │ D1 Database  │
│ (開発PC)    │         │ API Usage Manager    │         │ (永続化)     │
└─────────────┘         └──────────────────────┘         └──────────────┘
                                    ↑
┌─────────────┐                    │
│ CI/CD環境   │ ───────────────────┘
│ (GitHub)    │
└─────────────┘
```

#### リモート管理の利点

- **一元管理**: 複数環境から同じAPI使用状況を共有
- **永続化**: D1データベースで使用履歴を保存
- **認証**: API Keyによるセキュアなアクセス
- **ハイブリッドモード**: リモート障害時はローカルにフォールバック
- **環境別カウント**: テスト環境は自動的にカウント対象外

#### セットアップ

1. **Cloudflare Workers のデプロイ**

   ```bash
   cd next-engine-config/workers/api-usage-manager

   # 依存関係をインストール
   npm install

   # D1データベースを作成
   wrangler d1 create next-engine-api-usage

   # スキーマを適用
   wrangler d1 execute next-engine-api-usage --file=./schema.sql

   # API Keyを設定
   openssl rand -hex 32  # キーを生成
   wrangler secret put API_KEY  # 生成したキーを入力

   # デプロイ
   wrangler deploy
   ```

2. **ローカル環境の設定**

   ```bash
   # 環境変数を設定
   export NEXT_ENGINE_API_MANAGER_URL="https://next-engine-api-manager.YOUR-SUBDOMAIN.workers.dev"
   export NEXT_ENGINE_API_MANAGER_KEY="your-api-key-here"
   export NEXT_ENGINE_ENV="production"  # または "test"
   ```

3. **設定ファイルの更新**

   ```yaml
   # api-config.yaml
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

#### リモートAPI エンドポイント

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/usage` | GET | 現在の使用状況を取得 |
| `/api/usage/check` | POST | 実行可否をチェック（90%以上でブロック） |
| `/api/usage/record` | POST | API使用を記録 |
| `/api/usage/reset` | POST | 使用状況をリセット |

#### 実装例（リモート管理対応）

```typescript
import axios from 'axios';

interface RemoteApiConfig {
  url: string;
  apiKey: string;
}

// リモートAPIクライアント
class RemoteApiUsageClient {
  constructor(private config: RemoteApiConfig) {}

  private get headers() {
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  // 使用状況を取得
  async getUsage() {
    const response = await axios.get(
      `${this.config.url}/api/usage`,
      { headers: this.headers }
    );
    return response.data;
  }

  // 実行可否をチェック
  async checkUsage(environment: 'production' | 'test') {
    const response = await axios.post(
      `${this.config.url}/api/usage/check`,
      { environment },
      { headers: this.headers }
    );
    return response.data;
  }

  // API使用を記録
  async recordUsage(endpoint: string, success: boolean, environment: 'production' | 'test') {
    const response = await axios.post(
      `${this.config.url}/api/usage/record`,
      { endpoint, success, environment },
      { headers: this.headers }
    );
    return response.data;
  }

  // リセット
  async resetUsage() {
    const response = await axios.post(
      `${this.config.url}/api/usage/reset`,
      {},
      { headers: this.headers }
    );
    return response.data;
  }
}

// ハイブリッドモード実装
async function checkApiUsageLimitHybrid(): Promise<boolean> {
  const config = loadApiConfig();
  const environment = detectEnvironment(process.env.NEXT_ENGINE_API_URL || '');

  // テスト環境は常に許可
  if (environment === 'test') {
    console.log('✅ テスト環境のため実行許可');
    return true;
  }

  // リモート管理が有効な場合
  if (config.usage_tracking.remote.enabled) {
    try {
      const client = new RemoteApiUsageClient({
        url: config.usage_tracking.remote.api_url,
        apiKey: process.env[config.usage_tracking.remote.auth.api_key_env] || ''
      });

      const result = await client.checkUsage(environment);

      if (!result.allowed) {
        console.error(`🛑 ${result.reason}`);
        console.log(`使用状況: ${result.usage.used_percent.toFixed(1)}%`);
        return false;
      }

      if (result.warning) {
        console.warn(result.warning);
      }

      console.log(`✅ 実行許可 (残り ${result.usage.remaining}回)`);
      return true;

    } catch (error) {
      console.warn('⚠️ リモートAPI接続失敗、ローカルにフォールバック');

      // フォールバック: ローカルで確認
      if (config.usage_tracking.remote.fallback.use_local_on_failure) {
        return checkApiUsageLimitLocal();
      }

      throw error;
    }
  }

  // ローカルモード
  return checkApiUsageLimitLocal();
}

async function recordApiCallHybrid(endpoint: string, success: boolean) {
  const config = loadApiConfig();
  const environment = detectEnvironment(process.env.NEXT_ENGINE_API_URL || '');

  // リモート管理が有効な場合
  if (config.usage_tracking.remote.enabled) {
    try {
      const client = new RemoteApiUsageClient({
        url: config.usage_tracking.remote.api_url,
        apiKey: process.env[config.usage_tracking.remote.auth.api_key_env] || ''
      });

      const result = await client.recordUsage(endpoint, success, environment);

      console.log(`📊 環境: ${environment}`);
      console.log(`📈 使用状況: ${result.usage.used_percent.toFixed(1)}% (${result.usage.total_calls}/${1000})`);
      console.log(`カウント: ${result.counted ? 'あり' : 'なし (テスト環境)'}`);

      // ローカルファイルにも記録（バックアップ）
      if (config.usage_tracking.remote.fallback.use_local_on_failure) {
        recordApiCallLocal(endpoint, success, environment);
      }

    } catch (error) {
      console.warn('⚠️ リモートAPI記録失敗、ローカルに記録');
      recordApiCallLocal(endpoint, success, environment);
    }
  } else {
    // ローカルモード
    recordApiCallLocal(endpoint, success, environment);
  }
}

// 実際の使用例
async function syncProducts() {
  // 1. 環境検出
  const environment = detectEnvironment(process.env.NEXT_ENGINE_API_URL || '');
  console.log(`🔍 実行環境: ${environment}`);

  // 2. 事前チェック（リモート/ローカルハイブリッド）
  const canProceed = await checkApiUsageLimitHybrid();
  if (!canProceed) {
    throw new Error('API上限に達しているため実行できません');
  }

  // 3. APIコール
  try {
    const result = await api.post('receiveorder/product/search', params);

    // 4. 成功時の記録（リモート/ローカルハイブリッド）
    await recordApiCallHybrid('receiveorder/product/search', true);

    return result;
  } catch (error) {
    // 5. 失敗時も記録
    await recordApiCallHybrid('receiveorder/product/search', false);
    throw error;
  }
}
```

#### ブロック閾値の変更（90%）

リモート管理では **90%到達時点で自動ブロック** します：

```typescript
// Cloudflare Worker側の実装
async function checkUsage(request: Request, env: Env): Promise<Response> {
  const body = await request.json();
  const environment = body.environment || 'production';

  // テスト環境は常に許可
  if (environment === 'test') {
    return jsonResponse({
      allowed: true,
      reason: 'Test environment calls are not counted',
      usage: { /* ... */ }
    });
  }

  const usage = await getUsageFromDB(env);
  const usedPercent = (usage.total_calls / 1000) * 100;

  // 90%でブロック
  if (usedPercent >= 90) {
    return jsonResponse({
      allowed: false,
      reason: `API limit reached: ${usedPercent.toFixed(1)}% used (${usage.total_calls}/1000 calls)`,
      usage: {
        total_calls: usage.total_calls,
        remaining: 1000 - usage.total_calls,
        used_percent: usedPercent
      },
      threshold: 90
    }, 403);
  }

  // 80-90%で警告
  const warning = usedPercent >= 80
    ? `⚠️ Warning: ${usedPercent.toFixed(1)}% API usage`
    : undefined;

  return jsonResponse({
    allowed: true,
    warning,
    usage: { /* ... */ }
  });
}
```

#### ローカルフォールバック実装

リモートAPI障害時の動作：

```typescript
function checkApiUsageLimitLocal(): boolean {
  const config = loadApiConfig();
  const usage = loadApiUsage();

  const usedPercent = (usage.usage.total_calls / config.usage_limits.monthly_limit) * 100;

  // 90%でブロック
  if (usedPercent >= config.usage_limits.block_threshold_percent) {
    console.error(`🛑 API上限に達しました: ${usedPercent.toFixed(1)}%`);
    return false;
  }

  if (usedPercent >= config.usage_limits.danger_threshold_percent) {
    console.warn(`🚨 危険: ${usedPercent.toFixed(1)}% (残り${usage.limits.remaining}回)`);
  } else if (usedPercent >= config.usage_limits.warning_threshold_percent) {
    console.warn(`⚠️ 警告: ${usedPercent.toFixed(1)}% (残り${usage.limits.remaining}回)`);
  }

  return true;
}

function recordApiCallLocal(endpoint: string, success: boolean, environment: 'production' | 'test') {
  const usage = loadApiUsage();

  // 本番環境のみカウント
  if (environment === 'production') {
    usage.usage.total_calls++;
    usage.limits.remaining = usage.limits.monthly_limit - usage.usage.total_calls;
    usage.limits.used_percent = (usage.usage.total_calls / usage.limits.monthly_limit) * 100;
  }

  // 環境別統計
  usage.by_environment[environment] = (usage.by_environment[environment] || 0) + 1;

  // エンドポイント別記録
  usage.by_endpoint[endpoint] = (usage.by_endpoint[endpoint] || 0) + 1;

  saveApiUsage(usage);
}
```

#### 他のCloudflare Workersとの統合

認証トークン自動更新Workerなど、Next Engine関連の他のCloudflare Workersからもリモート管理を利用できます。

**統合ガイド**: `next-engine-config/workers/auth-integration-guide.md`

**統合例（認証Worker）:**

```typescript
// 認証Worker側の実装
import { recordApiUsage, checkApiUsageLimit } from './usage-tracker';

async function refreshTokens(env: Env) {
  // 1. API使用可能かチェック
  const canProceed = await checkApiUsageLimit(env);
  if (!canProceed) {
    throw new Error('API limit reached');
  }

  // 2. Next Engine APIコール
  const response = await fetch(
    'https://api.next-engine.org/api_v1_login_company/info',
    { /* ... */ }
  );

  const success = response.ok;

  // 3. API使用を記録
  await recordApiUsage(env, 'api_v1_login_company/info', success);

  return response;
}
```

**統合するWorkerの例:**
- 認証トークン自動更新Worker（1日2回 Cron = 月60回）
- 商品同期Worker
- 在庫更新Worker

すべてのNext Engine APIコールを一元管理することで、月1000回の無料枠を効率的に使用し、課金を防止できます。

### 使用前の必須チェック

APIコールを実行する前に、以下を必ず確認：

```bash
# 1. api-usage.json の存在確認
if [ ! -f next-engine-config/api-usage.json ]; then
  echo "⚠️ api-usage.json が存在しません"
  echo "テンプレートからコピーしてください："
  echo "cp next-engine-config/api-usage.json.example next-engine-config/api-usage.json"
  exit 1
fi

# 2. 現在の使用状況を確認
cat next-engine-config/api-usage.json | grep -E '(total_calls|remaining|used_percent)'
```

### API実行フロー（必須）

**すべてのAPIコールで以下のフローを守ること：**

```
1. api-config.yaml から月間上限を読み込み
2. api-usage.json から現在の使用回数を読み込み
3. 上限チェック：
   - 使用率 < 80%: 実行OK
   - 使用率 80-90%: ⚠️ 警告を表示して実行
   - 使用率 90-100%: 🚨 危険警告を表示して実行
   - 使用率 >= 100%: 🛑 実行をブロック（設定による）
4. APIコール実行
5. api-usage.json を更新（total_calls++）
6. エンドポイント別・日付別の記録も更新
```

### 使用状況ファイルの構造

`next-engine-config/api-usage.json`:

```json
{
  "usage": {
    "total_calls": 245,      // 今月の総コール数
    "successful_calls": 240,  // 成功したコール数
    "failed_calls": 5         // 失敗したコール数
  },
  "limits": {
    "monthly_limit": 1000,   // 月間上限
    "remaining": 755,         // 残り回数
    "used_percent": 24.5     // 使用率
  },
  "by_endpoint": {           // エンドポイント別の使用状況
    "receiveorder/product/search": 100,
    "receiveorder/stock/update": 145
  },
  "by_date": {               // 日別の使用状況
    "2026-01-04": 25
  }
}
```

### 設定ファイル

`next-engine-config/api-config.yaml`:

```yaml
usage_limits:
  monthly_limit: 1000  # お好みの値に変更可能
  warning_threshold_percent: 80
  danger_threshold_percent: 90

  on_limit_reached:
    behavior: block  # block: 停止 / warn: 警告のみ
```

### スキル実装時のガイドライン

Next Engineスキルを実装する際は、以下を遵守：

#### 1. 事前チェック関数

```typescript
async function checkApiUsageLimit(): Promise<boolean> {
  const config = loadApiConfig();
  const usage = loadApiUsage();

  const usedPercent = (usage.total_calls / config.monthly_limit) * 100;

  if (usedPercent >= 100) {
    if (config.on_limit_reached.behavior === 'block') {
      console.error('🛑 API上限に達しました。今月はこれ以上APIコールできません。');
      return false;
    }
  } else if (usedPercent >= config.danger_threshold_percent) {
    console.warn(`🚨 危険: API使用率 ${usedPercent.toFixed(1)}% (残り${usage.remaining}回)`);
  } else if (usedPercent >= config.warning_threshold_percent) {
    console.warn(`⚠️ 警告: API使用率 ${usedPercent.toFixed(1)}% (残り${usage.remaining}回)`);
  }

  return true;
}
```

#### 2. APIコール後の記録更新

```typescript
async function recordApiCall(endpoint: string, success: boolean) {
  const usage = loadApiUsage();
  const today = new Date().toISOString().split('T')[0];

  // 総コール数を更新
  usage.usage.total_calls++;
  if (success) {
    usage.usage.successful_calls++;
  } else {
    usage.usage.failed_calls++;
  }

  // 残り回数と使用率を更新
  usage.limits.remaining = usage.limits.monthly_limit - usage.usage.total_calls;
  usage.limits.used_percent = (usage.usage.total_calls / usage.limits.monthly_limit) * 100;

  // エンドポイント別記録
  usage.by_endpoint[endpoint] = (usage.by_endpoint[endpoint] || 0) + 1;

  // 日別記録
  usage.by_date[today] = (usage.by_date[today] || 0) + 1;

  // 最終更新日時
  usage.last_updated = new Date().toISOString();

  // ファイルに保存
  saveApiUsage(usage);
}
```

#### 3. 実装例

```typescript
async function syncProducts() {
  // 1. 事前チェック（必須）
  const canProceed = await checkApiUsageLimit();
  if (!canProceed) {
    throw new Error('API上限に達しているため実行できません');
  }

  // 2. APIコール
  try {
    const result = await api.post('receiveorder/product/search', params);

    // 3. 成功時の記録
    await recordApiCall('receiveorder/product/search', true);

    return result;
  } catch (error) {
    // 4. 失敗時も記録（エラーもカウント）
    await recordApiCall('receiveorder/product/search', false);
    throw error;
  }
}
```

### バッチ処理での注意

大量のAPIコールを行う場合：

```typescript
async function batchSync(items: Product[]) {
  // 事前に必要なコール数を計算
  const requiredCalls = items.length;
  const usage = loadApiUsage();

  if (usage.remaining < requiredCalls) {
    console.error(`🛑 残りAPI回数不足: 必要${requiredCalls}回、残り${usage.remaining}回`);
    console.log('提案: バッチサイズを減らすか、来月まで待つ');
    return;
  }

  // バッチ処理
  for (const item of items) {
    await syncProduct(item);  // 各APIコールで recordApiCall() を実行
  }
}
```

### 月次リセット

デフォルトでは毎月1日に自動リセット。手動リセットも可能：

```bash
# 手動リセット
rm next-engine-config/api-usage.json
cp next-engine-config/api-usage.json.example next-engine-config/api-usage.json

# リセット日時を記録
echo "Reset at: $(date)" >> next-engine-config/logs/reset-history.txt
```

## セキュリティ

- API キーは環境変数で管理
- アクセストークンの自動リフレッシュ
- 機密データのログ出力禁止
- 通信は HTTPS のみ
- **API使用状況ファイル (`api-usage.json`) はgitignore設定済み**

## 参考資料

- [Next Engine Developer Network](https://developer.next-engine.com/)
- [Next Engine API エンドポイント一覧](https://developer.next-engine.com/api)
- 設計書: `next-engine-skill-design.md`
