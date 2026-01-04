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

---

## オープンロジ連携

物流代行サービス「オープンロジ」との連携により、出荷業務を自動化します。

### 概要

オープンロジは、EC事業者向けの物流代行サービスです。商品の保管、ピッキング、梱包、発送までを一括で委託できます。

**メリット:**
- 物流業務の外部委託で業務効率化
- 倉庫スペース不要
- 配送品質の向上
- スケーラブルな物流体制

### 連携フロー

```
1. Next Engineで受注取得
   ↓
2. 出荷条件チェック（在庫、住所、商品マッピング等）
   ↓
3. ユーザー確認（デフォルトON、確認あり）★重要★
   ↓
4. オープンロジへ出荷指示送信
   ↓
5. オープンロジで出荷処理
   ↓
6. ステータス同期（出荷完了通知等）
```

### 設定ファイル

- **基本設定**: `next-engine-config/shipping-config.yaml` の `openlogi` セクション
- **詳細設定**: `next-engine-config/openlogi-config.yaml`

### 初期セットアップ

#### 1. オープンロジアカウント登録

```bash
# オープンロジに登録
# https://openlogi.com/

# API認証情報を取得
# 管理画面 → 設定 → API設定
```

#### 2. 環境変数設定

`.env` ファイルに認証情報を追加：

```bash
# オープンロジAPI認証
OPENLOGI_API_KEY="your-openlogi-api-key"
OPENLOGI_COMPANY_ID="your-company-id"

# 通知先メールアドレス
OPENLOGI_NOTIFICATION_EMAIL="your-email@example.com"
OPENLOGI_ERROR_NOTIFICATION_EMAIL="admin@example.com"
```

#### 3. 設定ファイルの調整

`shipping-config.yaml` を編集：

```yaml
openlogi:
  enabled: true
  default_service: true  # デフォルトで利用

  automation:
    auto_ship_instruction: true
    require_confirmation: true  # 確認を必須にする
    confirmation_timeout_hours: 24
```

`openlogi-config.yaml` を編集：

```yaml
workflow:
  order_to_ship:
    step3_confirmation:
      enabled: true
      confirmation_method: "interactive"  # 対話的確認

      # 確認が必要な条件
      require_confirmation_if:
        - condition: "always"  # 常に確認
```

#### 4. 商品マッピング設定

Next EngineのSKUとオープンロジのSKUをマッピング：

**方法1: 自動マッピング（推奨）**

```yaml
# openlogi-config.yaml
product_mapping:
  mapping_method: "auto"
  auto_mapping:
    use_product_code: true
    use_jan_code: true
```

**方法2: 手動マッピング（CSVファイル）**

```csv
# data/openlogi-sku-mapping.csv
next_engine_sku,openlogi_sku,product_name
SKU001,OPENLOGI-SKU-001,商品A
SKU002,OPENLOGI-SKU-002,商品B
```

```yaml
# openlogi-config.yaml
product_mapping:
  mapping_method: "manual"
  manual_mapping:
    csv_file: "./data/openlogi-sku-mapping.csv"
```

### 基本的な使用方法

#### `/next-engine-openlogi` コマンド

オープンロジ連携を実行します。

```bash
# 基本実行（確認あり）
/next-engine-openlogi

# オプション
/next-engine-openlogi --dry-run        # 実行せず確認のみ
/next-engine-openlogi --no-confirm     # 確認スキップ（注意）
/next-engine-openlogi --batch-size 30  # バッチサイズ指定
```

#### TypeScript実装例

```typescript
import axios from 'axios';
import * as yaml from 'js-yaml';
import * as fs from 'fs';

// 設定読み込み
const shippingConfig = yaml.load(
  fs.readFileSync('next-engine-config/shipping-config.yaml', 'utf8')
) as any;

const openlogiConfig = yaml.load(
  fs.readFileSync('next-engine-config/openlogi-config.yaml', 'utf8')
) as any;

// オープンロジAPIクライアント
class OpenlogiClient {
  private apiKey: string;
  private companyId: string;
  private apiEndpoint: string;

  constructor() {
    this.apiKey = process.env.OPENLOGI_API_KEY || '';
    this.companyId = process.env.OPENLOGI_COMPANY_ID || '';
    this.apiEndpoint = shippingConfig.openlogi.auth.api_endpoint;
  }

  // 出荷指示送信
  async sendShipInstruction(order: Order): Promise<ShipInstructionResponse> {
    const response = await axios.post(
      `${this.apiEndpoint}/ship_instructions`,
      {
        company_id: this.companyId,
        order_id: order.order_id,
        customer: {
          name: order.customer_name,
          postal_code: order.postal_code,
          address: order.address,
          phone: order.phone,
        },
        items: order.items.map(item => ({
          sku: item.openlogi_sku,  // マッピング済みSKU
          quantity: item.quantity,
        })),
        delivery_options: {
          date: order.delivery_date,
          time: order.delivery_time,
          gift_wrapping: order.gift_wrapping,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  }

  // ステータス取得
  async getShipmentStatus(instructionId: string): Promise<ShipmentStatus> {
    const response = await axios.get(
      `${this.apiEndpoint}/ship_instructions/${instructionId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      }
    );

    return response.data;
  }

  // 在庫取得
  async getInventory(): Promise<InventoryItem[]> {
    const response = await axios.get(
      `${this.apiEndpoint}/inventory`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        params: {
          company_id: this.companyId,
        },
      }
    );

    return response.data.items;
  }
}

// オープンロジ連携ワークフロー
class OpenlogiWorkflow {
  private nextEngineClient: NextEngineClient;
  private openlogiClient: OpenlogiClient;

  constructor() {
    this.nextEngineClient = new NextEngineClient();
    this.openlogiClient = new OpenlogiClient();
  }

  // Step 1: 受注取得
  async fetchOrders(): Promise<Order[]> {
    const config = openlogiConfig.workflow.order_to_ship.step1_fetch_orders;

    const orders = await this.nextEngineClient.searchOrders({
      status: config.target_statuses,
      limit: config.max_orders_per_fetch,
    });

    console.log(`📥 受注取得: ${orders.length}件`);
    return orders;
  }

  // Step 2: 出荷条件チェック
  async validateOrders(orders: Order[]): Promise<Order[]> {
    const config = openlogiConfig.workflow.order_to_ship.step2_validation;
    const validOrders: Order[] = [];

    for (const order of orders) {
      let isValid = true;
      const errors: string[] = [];

      // 在庫確認
      if (config.checks.find(c => c.check === 'stock_availability')?.required) {
        const hasStock = await this.checkStock(order);
        if (!hasStock) {
          errors.push('在庫不足');
          isValid = false;
        }
      }

      // 住所確認
      if (config.checks.find(c => c.check === 'address_completeness')?.required) {
        const addressComplete = this.validateAddress(order);
        if (!addressComplete) {
          errors.push('住所不完全');
          isValid = false;
        }
      }

      // 商品マッピング確認
      if (config.checks.find(c => c.check === 'product_mapping')?.required) {
        const allMapped = await this.checkProductMapping(order);
        if (!allMapped) {
          errors.push('商品マッピング未設定');
          isValid = false;
        }
      }

      if (isValid) {
        validOrders.push(order);
      } else {
        console.log(`⚠️ 注文 ${order.order_id}: ${errors.join(', ')}`);
      }
    }

    console.log(`✅ バリデーション通過: ${validOrders.length}/${orders.length}件`);
    return validOrders;
  }

  // Step 3: ユーザー確認（重要）
  async confirmShipment(orders: Order[]): Promise<Order[]> {
    const config = openlogiConfig.workflow.order_to_ship.step3_confirmation;

    if (!config.enabled || config.confirmation_method === 'auto') {
      return orders;
    }

    // 確認情報の表示
    console.log('\n📦 出荷指示確認\n');
    console.log('─'.repeat(60));

    let totalCost = 0;
    for (const order of orders) {
      console.log(`\n注文ID: ${order.order_id}`);
      console.log(`顧客名: ${order.customer_name}`);
      console.log(`配送先: ${order.address}`);
      console.log(`商品数: ${order.items.length}点`);

      const cost = this.calculateShippingCost(order);
      totalCost += cost;
      console.log(`推定コスト: ¥${cost.toLocaleString()}`);
    }

    console.log('\n─'.repeat(60));
    console.log(`合計: ${orders.length}件の注文`);
    console.log(`推定総コスト: ¥${totalCost.toLocaleString()}`);
    console.log('\n');

    // ユーザー確認
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const confirmed = await new Promise<boolean>(resolve => {
      readline.question(
        'オープンロジへ出荷指示を送信しますか？ (y/N): ',
        (answer: string) => {
          readline.close();
          resolve(answer.toLowerCase() === 'y');
        }
      );
    });

    if (!confirmed) {
      console.log('❌ 出荷指示をキャンセルしました');
      return [];
    }

    console.log('✅ 出荷指示を承認しました');
    return orders;
  }

  // Step 4: オープンロジへ出荷指示送信
  async sendInstructions(orders: Order[]): Promise<void> {
    const config = openlogiConfig.workflow.order_to_ship.step4_send_instruction;

    if (config.send_method === 'batch') {
      // バッチ送信
      const batchSize = config.batch_settings.batch_size;

      for (let i = 0; i < orders.length; i += batchSize) {
        const batch = orders.slice(i, i + batchSize);
        console.log(`\n📤 バッチ送信 (${i + 1}-${Math.min(i + batchSize, orders.length)}/${orders.length})`);

        for (const order of batch) {
          try {
            const result = await this.openlogiClient.sendShipInstruction(order);
            console.log(`  ✅ ${order.order_id}: 指示ID ${result.instruction_id}`);

            // Next Engineステータス更新
            await this.nextEngineClient.updateOrderStatus(
              order.order_id,
              'openlogi_instructed'
            );
          } catch (error) {
            console.error(`  ❌ ${order.order_id}: ${error.message}`);

            // リトライ処理
            if (config.retry.enabled) {
              await this.retryInstruction(order, config.retry);
            }
          }
        }

        // バッチ間のインターバル
        if (i + batchSize < orders.length) {
          await this.sleep(config.batch_settings.batch_interval_minutes * 60 * 1000);
        }
      }
    } else {
      // リアルタイム送信
      for (const order of orders) {
        await this.openlogiClient.sendShipInstruction(order);
      }
    }

    console.log('\n✅ 出荷指示送信完了');
  }

  // ステータス同期
  async syncStatus(): Promise<void> {
    const config = openlogiConfig.workflow.status_polling;

    console.log('🔄 オープンロジステータス同期開始');

    // オープンロジ出荷中の注文を取得
    const orders = await this.nextEngineClient.searchOrders({
      status: ['openlogi_instructed', 'openlogi_received', 'openlogi_picking', 'openlogi_packing'],
    });

    for (const order of orders) {
      if (!order.openlogi_instruction_id) continue;

      try {
        const status = await this.openlogiClient.getShipmentStatus(
          order.openlogi_instruction_id
        );

        // ステータスマッピング
        const statusMapping = shippingConfig.openlogi.status_sync.status_mapping;
        const newStatus = statusMapping[status.status];

        if (newStatus && newStatus !== order.status) {
          await this.nextEngineClient.updateOrderStatus(order.order_id, newStatus);
          console.log(`  🔄 ${order.order_id}: ${order.status} → ${newStatus}`);

          // 出荷完了時の処理
          if (newStatus === 'shipped') {
            await this.handleShipped(order, status);
          }
        }
      } catch (error) {
        console.error(`  ❌ ${order.order_id}: ${error.message}`);
      }
    }

    console.log('✅ ステータス同期完了');
  }

  // 出荷完了処理
  private async handleShipped(order: Order, status: ShipmentStatus): Promise<void> {
    // 追跡番号を更新
    if (status.tracking_number) {
      await this.nextEngineClient.updateOrder(order.order_id, {
        tracking_number: status.tracking_number,
      });
    }

    // お客様に出荷通知メール送信
    // await this.sendShippingNotification(order, status.tracking_number);

    // モールに同期
    // await this.syncToMalls(order);

    console.log(`  📧 出荷通知送信: ${order.order_id}`);
  }

  // ヘルパーメソッド
  private async checkStock(order: Order): Promise<boolean> {
    // 在庫確認ロジック
    return true;
  }

  private validateAddress(order: Order): boolean {
    return !!(order.postal_code && order.address && order.customer_name);
  }

  private async checkProductMapping(order: Order): Promise<boolean> {
    // 全商品がマッピング済みか確認
    for (const item of order.items) {
      if (!item.openlogi_sku) return false;
    }
    return true;
  }

  private calculateShippingCost(order: Order): number {
    const pricing = shippingConfig.openlogi.pricing;
    let cost = pricing.shipping_fee_per_order;
    cost += order.items.length * pricing.packing_material_fee;
    return cost;
  }

  private async retryInstruction(order: Order, retryConfig: any): Promise<void> {
    // リトライロジック
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 実行
async function main() {
  const workflow = new OpenlogiWorkflow();

  // Step 1-4: 出荷指示送信
  const orders = await workflow.fetchOrders();
  const validOrders = await workflow.validateOrders(orders);
  const confirmedOrders = await workflow.confirmShipment(validOrders);
  await workflow.sendInstructions(confirmedOrders);

  // ステータス同期（定期実行）
  setInterval(async () => {
    await workflow.syncStatus();
  }, 30 * 60 * 1000);  // 30分ごと
}

// main().catch(console.error);
```

### 在庫同期

オープンロジの在庫をNext Engineに同期：

```typescript
async function syncInventoryFromOpenlogi() {
  const openlogiClient = new OpenlogiClient();
  const nextEngineClient = new NextEngineClient();

  // オープンロジから在庫取得
  const inventory = await openlogiClient.getInventory();

  for (const item of inventory) {
    // SKUマッピング（オープンロジ → Next Engine）
    const nextEngineSku = await getNextEngineSku(item.sku);
    if (!nextEngineSku) continue;

    // Next Engineの在庫を更新
    await nextEngineClient.updateStock(nextEngineSku, {
      stock_quantity: item.quantity,
      warehouse: 'openlogi',
    });

    console.log(`🔄 ${nextEngineSku}: 在庫 ${item.quantity}`);
  }

  console.log('✅ 在庫同期完了');
}
```

### コスト管理

オープンロジ利用コストを計算・レポート：

```typescript
async function generateCostReport(month: string) {
  const config = openlogiConfig.cost_management;

  // 該当月の出荷データ取得
  const shipments = await getShipmentsForMonth(month);

  let totalCost = 0;
  const breakdown = {
    storage: 0,
    shipping: 0,
    packing: 0,
    services: 0,
  };

  for (const shipment of shipments) {
    // 出荷手数料
    const shippingCost =
      config.cost_items.shipping_fee.base_fee +
      (shipment.items.length * config.cost_items.shipping_fee.additional_per_item);
    breakdown.shipping += shippingCost;

    // 梱包資材費
    const packingCost = config.cost_items.packing_material.base_fee;
    breakdown.packing += packingCost;

    totalCost += shippingCost + packingCost;
  }

  // レポート出力
  const report = {
    month,
    total_shipments: shipments.length,
    costs: {
      total: totalCost,
      breakdown,
      per_shipment: totalCost / shipments.length,
    },
  };

  fs.writeFileSync(
    `${config.cost_report.output_dir}/${month}.json`,
    JSON.stringify(report, null, 2)
  );

  console.log(`📊 コストレポート生成: ${month}`);
  console.log(`   総コスト: ¥${totalCost.toLocaleString()}`);
  console.log(`   出荷数: ${shipments.length}件`);
  console.log(`   平均単価: ¥${(totalCost / shipments.length).toLocaleString()}`);
}
```

### トラブルシューティング

#### オープンロジAPI接続エラー

```bash
# API認証情報を確認
echo $OPENLOGI_API_KEY
echo $OPENLOGI_COMPANY_ID

# 接続テスト
curl -H "Authorization: Bearer $OPENLOGI_API_KEY" \
  https://api.openlogi.com/v1/ping
```

#### 商品マッピングエラー

```bash
# マッピングされていない商品を確認
/next-engine-openlogi --check-mapping

# 手動マッピングCSVを生成
/next-engine-openlogi --export-unmapped
```

#### ステータス同期の遅延

```yaml
# openlogi-config.yaml
workflow:
  status_polling:
    interval_minutes: 15  # 30分 → 15分に短縮
```

### ベストプラクティス

1. **確認フローは必須**
   - `require_confirmation: true` を維持
   - 高額注文は特に慎重に確認

2. **バッチ処理を活用**
   - 一度に大量の出荷指示を送信しない
   - APIレート制限に注意

3. **在庫同期は頻繁に**
   - 1時間ごとの同期を推奨
   - 在庫切れを防ぐ

4. **コスト監視**
   - 月次レポートで予算管理
   - 予想外のコスト増加に注意

5. **エラーハンドリング**
   - リトライ機能を有効化
   - フォールバック先を用意

### セキュリティ

- API キーは環境変数で管理
- `.env` ファイルは `.gitignore` に追加済み
- 本番環境とテスト環境で異なるAPI キーを使用

### ブラウザ自動操作（API利用不可時のフォールバック）

API が利用できない場合、Puppeteer を使用してブラウザを自動操作します。

#### 依存関係のインストール

```bash
npm install puppeteer
# または
yarn add puppeteer
```

#### ブラウザ自動操作クライアントの実装

```typescript
import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs/promises';
import * as path from 'path';

interface BrowserConfig {
  headless: boolean;
  viewport: { width: number; height: number };
  userAgent: string;
}

interface LoginCredentials {
  username: string;
  password: string;
  totpSecret?: string;
}

interface ShipmentData {
  orderNumber: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  items: Array<{
    sku: string;
    quantity: number;
  }>;
  deliveryDate?: string;
  deliveryTime?: string;
  notes?: string;
}

class OpenlogiBrowserClient {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: BrowserConfig;
  private sessionCookiePath: string;

  constructor() {
    const browserConfig = openlogiConfig.browser_automation.browser;
    this.config = {
      headless: browserConfig.headless,
      viewport: browserConfig.launch_options.viewport,
      userAgent: openlogiConfig.browser_automation.security.user_agent,
    };
    this.sessionCookiePath = openlogiConfig.browser_automation.authentication.session.cookie_file;
  }

  /**
   * ブラウザを起動
   */
  async launch(): Promise<void> {
    console.log('🌐 ブラウザを起動中...');

    this.browser = await puppeteer.launch({
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });

    this.page = await this.browser.newPage();

    // ビューポート設定
    await this.page.setViewport(this.config.viewport);

    // User-Agent 設定
    await this.page.setUserAgent(this.config.userAgent);

    // コンソールログの記録
    if (openlogiConfig.browser_automation.logging.console_logs) {
      this.page.on('console', msg => {
        console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
      });
    }

    // ネットワークリクエストの記録
    if (openlogiConfig.browser_automation.logging.network_logs) {
      await this.page.setRequestInterception(true);
      this.page.on('request', request => {
        console.log(`[Network] ${request.method()} ${request.url()}`);
        request.continue();
      });
    }

    console.log('✅ ブラウザ起動完了');
  }

  /**
   * セッションCookieを読み込み
   */
  private async loadSessionCookies(): Promise<boolean> {
    try {
      const cookieData = await fs.readFile(this.sessionCookiePath, 'utf-8');
      const cookies = JSON.parse(cookieData);

      if (!this.page) return false;

      await this.page.setCookie(...cookies);
      console.log('✅ セッションCookieを読み込みました');
      return true;
    } catch (error) {
      console.log('ℹ️ セッションCookieが見つかりません。ログインが必要です。');
      return false;
    }
  }

  /**
   * セッションCookieを保存
   */
  private async saveSessionCookies(): Promise<void> {
    if (!this.page) return;

    const cookies = await this.page.cookies();
    await fs.mkdir(path.dirname(this.sessionCookiePath), { recursive: true });
    await fs.writeFile(this.sessionCookiePath, JSON.stringify(cookies, null, 2));
    console.log('✅ セッションCookieを保存しました');
  }

  /**
   * ログイン処理
   */
  async login(credentials: LoginCredentials): Promise<void> {
    if (!this.page) {
      throw new Error('ブラウザが起動していません');
    }

    console.log('🔐 ログイン処理を開始...');

    const authConfig = openlogiConfig.browser_automation.authentication;

    // ログインページへ移動
    await this.page.goto(authConfig.login_url, {
      waitUntil: 'networkidle2',
      timeout: openlogiConfig.browser_automation.error_handling.timeouts.page_load,
    });

    // ユーザー名入力
    await this.page.type('input[name="username"]', credentials.username, {
      delay: openlogiConfig.browser_automation.tasks.create_shipment.input_delay,
    });

    // パスワード入力
    await this.page.type('input[name="password"]', credentials.password, {
      delay: openlogiConfig.browser_automation.tasks.create_shipment.input_delay,
    });

    // ログインボタンをクリック
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
      this.page.click('button[type="submit"]'),
    ]);

    // 2要素認証（必要な場合）
    if (authConfig.two_factor.enabled && credentials.totpSecret) {
      await this.handle2FA(credentials.totpSecret);
    }

    // セッションCookieを保存
    if (authConfig.session.save_cookies) {
      await this.saveSessionCookies();
    }

    console.log('✅ ログイン完了');
  }

  /**
   * 2要素認証の処理
   */
  private async handle2FA(totpSecret: string): Promise<void> {
    if (!this.page) return;

    console.log('🔐 2要素認証処理...');

    // TOTP コードを生成（speakeasyライブラリなどを使用）
    const speakeasy = require('speakeasy');
    const token = speakeasy.totp({
      secret: totpSecret,
      encoding: 'base32',
    });

    // TOTPコードを入力
    await this.page.type('input[name="totp"]', token);
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
      this.page.click('button[type="submit"]'),
    ]);

    console.log('✅ 2要素認証完了');
  }

  /**
   * 出荷指示を登録
   */
  async createShipment(shipmentData: ShipmentData): Promise<void> {
    if (!this.page) {
      throw new Error('ブラウザが起動していません');
    }

    console.log(`📦 出荷指示を登録: ${shipmentData.orderNumber}`);

    const taskConfig = openlogiConfig.browser_automation.tasks.create_shipment;
    const selectors = taskConfig.selectors;

    try {
      // 出荷登録ページへ移動
      await this.page.goto(taskConfig.page_url, {
        waitUntil: 'networkidle2',
        timeout: openlogiConfig.browser_automation.error_handling.timeouts.page_load,
      });

      // 注文番号
      await this.page.waitForSelector(selectors.order_number, {
        timeout: openlogiConfig.browser_automation.error_handling.timeouts.element_wait,
      });
      await this.page.type(selectors.order_number, shipmentData.orderNumber, {
        delay: taskConfig.input_delay,
      });

      // 顧客情報
      await this.page.type(selectors.customer_name, shipmentData.customerName, {
        delay: taskConfig.input_delay,
      });
      await this.page.type(selectors.customer_address, shipmentData.customerAddress, {
        delay: taskConfig.input_delay,
      });
      await this.page.type(selectors.customer_phone, shipmentData.customerPhone, {
        delay: taskConfig.input_delay,
      });

      // 商品情報
      for (let i = 0; i < shipmentData.items.length; i++) {
        const item = shipmentData.items[i];

        // 商品行を追加（2行目以降）
        if (i > 0) {
          await this.page.click('.add-item-button');
          await this.page.waitForTimeout(500);
        }

        // SKUと数量を入力
        await this.page.type(`${selectors.item_sku}:nth-of-type(${i + 1})`, item.sku, {
          delay: taskConfig.input_delay,
        });
        await this.page.type(`${selectors.item_quantity}:nth-of-type(${i + 1})`, item.quantity.toString(), {
          delay: taskConfig.input_delay,
        });
      }

      // 配送日時（オプション）
      if (shipmentData.deliveryDate) {
        await this.page.type(selectors.delivery_date, shipmentData.deliveryDate, {
          delay: taskConfig.input_delay,
        });
      }
      if (shipmentData.deliveryTime) {
        await this.page.select(selectors.delivery_time, shipmentData.deliveryTime);
      }

      // 備考（オプション）
      if (shipmentData.notes) {
        await this.page.type(selectors.notes, shipmentData.notes, {
          delay: taskConfig.input_delay,
        });
      }

      // スクリーンショット（送信前）
      await this.takeScreenshot(`shipment-${shipmentData.orderNumber}-before-submit`);

      // 確認ダイアログの処理
      if (taskConfig.confirm_dialogs) {
        this.page.on('dialog', async dialog => {
          console.log(`[Dialog] ${dialog.message()}`);
          await dialog.accept();
        });
      }

      // 送信ボタンをクリック
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
        this.page.click(selectors.submit_button),
      ]);

      // ページ遷移待機
      await this.page.waitForTimeout(taskConfig.page_transition_delay);

      // スクリーンショット（送信後）
      await this.takeScreenshot(`shipment-${shipmentData.orderNumber}-after-submit`);

      console.log(`✅ 出荷指示登録完了: ${shipmentData.orderNumber}`);
    } catch (error) {
      console.error(`❌ 出荷指示登録エラー: ${shipmentData.orderNumber}`, error);

      // エラー時のスクリーンショット
      await this.takeScreenshot(`error-shipment-${shipmentData.orderNumber}`);

      // HTML保存
      if (openlogiConfig.browser_automation.error_handling.save_html_on_error) {
        await this.savePageHTML(`error-shipment-${shipmentData.orderNumber}`);
      }

      throw error;
    }
  }

  /**
   * 在庫情報を取得
   */
  async fetchInventory(): Promise<Array<{ sku: string; quantity: number; location: string }>> {
    if (!this.page) {
      throw new Error('ブラウザが起動していません');
    }

    console.log('📊 在庫情報を取得中...');

    const taskConfig = openlogiConfig.browser_automation.tasks.fetch_inventory;
    const selectors = taskConfig.selectors;
    const inventory: Array<{ sku: string; quantity: number; location: string }> = [];

    await this.page.goto(taskConfig.page_url, {
      waitUntil: 'networkidle2',
    });

    let currentPage = 1;
    const maxPages = taskConfig.pagination.max_pages;

    while (currentPage <= maxPages) {
      console.log(`ページ ${currentPage} を処理中...`);

      // テーブルを待機
      await this.page.waitForSelector(selectors.inventory_table);

      // 在庫データを抽出
      const pageInventory = await this.page.evaluate((selectors) => {
        const rows = document.querySelectorAll(`${selectors.inventory_table} tbody tr`);
        const data: Array<{ sku: string; quantity: number; location: string }> = [];

        rows.forEach(row => {
          const sku = row.querySelector(selectors.sku_column)?.textContent?.trim() || '';
          const quantityText = row.querySelector(selectors.quantity_column)?.textContent?.trim() || '0';
          const quantity = parseInt(quantityText, 10);
          const location = row.querySelector(selectors.location_column)?.textContent?.trim() || '';

          if (sku) {
            data.push({ sku, quantity, location });
          }
        });

        return data;
      }, selectors);

      inventory.push(...pageInventory);

      // 次のページへ
      if (taskConfig.pagination.enabled) {
        const hasNextPage = await this.page.$(taskConfig.pagination.next_button);
        if (hasNextPage) {
          await this.page.click(taskConfig.pagination.next_button);
          await this.page.waitForTimeout(2000);
          currentPage++;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    console.log(`✅ 在庫情報取得完了: ${inventory.length}件`);
    return inventory;
  }

  /**
   * スクリーンショットを保存
   */
  private async takeScreenshot(filename: string): Promise<void> {
    if (!this.page) return;

    const screenshotDir = openlogiConfig.browser_automation.browser.screenshot_dir;
    await fs.mkdir(screenshotDir, { recursive: true });

    const filepath = path.join(screenshotDir, `${filename}.png`);
    await this.page.screenshot({ path: filepath, fullPage: true });
    console.log(`📸 スクリーンショット保存: ${filepath}`);
  }

  /**
   * ページHTMLを保存
   */
  private async savePageHTML(filename: string): Promise<void> {
    if (!this.page) return;

    const htmlDir = openlogiConfig.browser_automation.error_handling.html_output_dir;
    await fs.mkdir(htmlDir, { recursive: true });

    const html = await this.page.content();
    const filepath = path.join(htmlDir, `${filename}.html`);
    await fs.writeFile(filepath, html);
    console.log(`💾 HTML保存: ${filepath}`);
  }

  /**
   * ブラウザを終了
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      console.log('✅ ブラウザ終了');
    }
  }
}
```

#### ブラウザ自動操作を使用したワークフロー

```typescript
/**
 * API利用不可時のフォールバック処理
 */
class OpenlogiFallbackWorkflow {
  private apiClient: OpenlogiClient;
  private browserClient: OpenlLogiBrowserClient;
  private consecutiveApiErrors: number = 0;

  constructor() {
    this.apiClient = new OpenlogiClient();
    this.browserClient = new OpenlLogiBrowserClient();
  }

  /**
   * ブラウザ自動操作を使用すべきか判定
   */
  private shouldUseBrowserAutomation(): boolean {
    const config = openlogiConfig.browser_automation;

    if (!config.enabled) {
      return false;
    }

    const useWhen = config.use_when;

    // APIエラー連続発生時
    if (this.consecutiveApiErrors >= useWhen.consecutive_api_errors) {
      console.log('⚠️ API連続エラー検出。ブラウザ自動操作に切り替えます。');
      return true;
    }

    return false;
  }

  /**
   * 出荷指示を送信（フォールバック付き）
   */
  async sendShipmentInstruction(order: Order): Promise<void> {
    try {
      // まずAPIを試行
      if (!this.shouldUseBrowserAutomation()) {
        await this.apiClient.createShipment(order);
        this.consecutiveApiErrors = 0; // 成功したのでリセット
        return;
      }
    } catch (error) {
      console.error('❌ API呼び出しエラー:', error);
      this.consecutiveApiErrors++;

      // ブラウザ自動操作にフォールバック
      if (this.shouldUseBrowserAutomation()) {
        await this.sendShipmentViaBrowser(order);
        return;
      }

      throw error;
    }
  }

  /**
   * ブラウザ自動操作で出荷指示を送信
   */
  private async sendShipmentViaBrowser(order: Order): Promise<void> {
    console.log('🌐 ブラウザ自動操作で出荷指示を送信します');

    try {
      // ブラウザ起動
      await this.browserClient.launch();

      // セッションCookieを読み込み、必要ならログイン
      const hasSession = await this.browserClient['loadSessionCookies']();
      if (!hasSession) {
        const credentials = {
          username: process.env.OPENLOGI_BROWSER_USERNAME!,
          password: process.env.OPENLOGI_BROWSER_PASSWORD!,
          totpSecret: process.env.OPENLOGI_TOTP_SECRET,
        };
        await this.browserClient.login(credentials);
      }

      // 出荷指示を登録
      const shipmentData: ShipmentData = {
        orderNumber: order.order_id,
        customerName: order.customer_name,
        customerAddress: order.address,
        customerPhone: order.phone,
        items: order.items.map(item => ({
          sku: item.sku,
          quantity: item.quantity,
        })),
        deliveryDate: order.delivery_date,
        deliveryTime: order.delivery_time,
        notes: order.notes,
      };

      await this.browserClient.createShipment(shipmentData);

      console.log('✅ ブラウザ自動操作による出荷指示送信完了');

      // 通知
      if (openlogiConfig.browser_automation.notifications.on_browser_fallback.enabled) {
        await this.sendFallbackNotification(order);
      }

    } catch (error) {
      console.error('❌ ブラウザ自動操作エラー:', error);
      throw error;
    } finally {
      // ブラウザインスタンスの再利用設定を確認
      if (!openlogiConfig.browser_automation.performance.reuse_browser) {
        await this.browserClient.close();
      }
    }
  }

  /**
   * フォールバック通知を送信
   */
  private async sendFallbackNotification(order: Order): Promise<void> {
    const message = `
API利用不可のため、ブラウザ自動操作に切り替えました。

注文番号: ${order.order_id}
顧客名: ${order.customer_name}
`;

    // メール送信処理（実装は省略）
    console.log('📧 フォールバック通知送信:', message);
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    await this.browserClient.close();
  }
}
```

#### 使用例

```typescript
// フォールバックワークフローの使用
const workflow = new OpenlogiFallbackWorkflow();

try {
  // 注文データ
  const order: Order = {
    order_id: 'ORDER-12345',
    customer_name: '山田太郎',
    address: '東京都渋谷区...',
    phone: '090-1234-5678',
    items: [
      { sku: 'SKU-001', quantity: 2 },
      { sku: 'SKU-002', quantity: 1 },
    ],
    delivery_date: '2024-12-25',
    delivery_time: '午前中',
    notes: '置き配希望',
  };

  // API優先、エラー時は自動的にブラウザ操作へフォールバック
  await workflow.sendShipmentInstruction(order);

} catch (error) {
  console.error('出荷指示送信に失敗しました:', error);
} finally {
  await workflow.cleanup();
}
```

#### 必要な追加パッケージ

2要素認証（TOTP）を使用する場合:

```bash
npm install speakeasy
npm install @types/speakeasy --save-dev
```

#### .gitignore への追加

```gitignore
# ブラウザ自動操作関連
next-engine-config/cache/openlogi-session.json
next-engine-config/logs/browser-screenshots/
next-engine-config/logs/browser-errors/
next-engine-config/logs/browser-automation.log
```

### 参考資料

- [オープンロジ公式サイト](https://openlogi.com/)
- [オープンロジAPI ドキュメント](https://openlogi.com/api-docs/)
- [Puppeteer ドキュメント](https://pptr.dev/)
- 設定ファイル: `shipping-config.yaml`, `openlogi-config.yaml`
