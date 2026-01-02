# ネクストエンジン × オープンロジ 連携設計書

## 概要

ネクストエンジンとオープンロジ（OPENLOGI）を連携させ、受注から出荷までの物流業務を自動化する設計書です。
ネクストエンジンのUI操作が必要な場合は、Claude Code の Chrome モード（Playwright/Chrome DevTools）を使用します。

---

## 1. システム構成

### 1.1 全体アーキテクチャ

```
[ECモール] → [ネクストエンジン] → [オープンロジ] → [配送業者]
    ↓              ↓                    ↓              ↓
  受注取込     在庫連携           ピッキング      追跡番号
                  ↓                    ↓
            商品マスタ同期        出荷処理
                  ↓                    ↓
              在庫更新          ステータス更新
```

### 1.2 連携方式

| システム | 連携方法 | 用途 |
|---------|---------|------|
| **ネクストエンジン API** | REST API | 商品・受注・在庫データの取得/更新 |
| **オープンロジ API** | REST API | 出荷指示、在庫照会、追跡番号取得 |
| **Chrome自動操作** | Playwright/Chrome DevTools | API未対応の画面操作 |

---

## 2. オープンロジ連携仕様

### 2.1 前提条件

**必要な契約・設定:**
- ネクストエンジンとオープンロジの連携設定済み
- オープンロジ API キー取得済み
- ネクストエンジンでオープンロジアプリを有効化

**参考資料:**
- [ネクストエンジン連携について - OPENLOGI](https://help.openlogi.com/s/topic/0TO6F000000X8FZWA0/)
- [ネクストエンジンAPIについて解説 - OPENLOGI](https://service.openlogi.com/openlogi_mag/next_engine_api/)
- [ネクストエンジン連携 LP - OPENLOGI](https://service.openlogi.com/nextengine-lp/)

### 2.2 データフロー

#### Phase 1: 商品マスタ同期

```yaml
# オープンロジ連携設定
openlogi:
  api:
    endpoint: "https://api.openlogi.com/v1"
    api_key: "${OPENLOGI_API_KEY}"
    warehouse_code: "${OPENLOGI_WAREHOUSE_CODE}"

  # 商品マスタ同期
  product_sync:
    direction: bidirectional    # 双方向同期
    schedule: daily             # 1日1回
    sync_fields:
      # ネクストエンジン → オープンロジ
      - product_code
      - product_name
      - jan_code
      - weight
      - dimensions
      - fragile_flag

      # オープンロジ → ネクストエンジン
      - warehouse_stock         # 倉庫在庫数
      - location_code           # ロケーションコード
```

**実装例:**
```typescript
// src/services/openlogi-sync-service.ts

interface OpenlogiConfig {
  endpoint: string;
  apiKey: string;
  warehouseCode: string;
}

class OpenlogiSyncService {
  constructor(
    private openlogiConfig: OpenlogiConfig,
    private nextEngineClient: NextEngineClient
  ) {}

  // 商品マスタ同期
  async syncProductMaster(): Promise<SyncResult> {
    // 1. ネクストエンジンから商品データ取得
    const neProducts = await this.nextEngineClient.searchProducts({
      fields: ['product_code', 'product_name', 'jan_code'],
    });

    // 2. オープンロジに商品登録/更新
    const results = await Promise.all(
      neProducts.map(async (product) => {
        try {
          await this.registerToOpenlogi(product);
          return { product_code: product.code, status: 'success' };
        } catch (error) {
          return { product_code: product.code, status: 'failed', error };
        }
      })
    );

    return {
      total: neProducts.length,
      success: results.filter((r) => r.status === 'success').length,
      failed: results.filter((r) => r.status === 'failed').length,
    };
  }

  // オープンロジに商品登録
  private async registerToOpenlogi(
    product: NextEngineProduct
  ): Promise<void> {
    const response = await axios.post(
      `${this.openlogiConfig.endpoint}/products`,
      {
        warehouse_code: this.openlogiConfig.warehouseCode,
        product_code: product.code,
        product_name: product.name,
        jan_code: product.jan_code,
        // ... その他の商品情報
      },
      {
        headers: {
          'X-API-Key': this.openlogiConfig.apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status !== 200) {
      throw new Error(`Failed to register product: ${product.code}`);
    }
  }
}
```

#### Phase 2: 受注データ連携

```
[受注] → ネクストエンジン → オープンロジ → 出荷指示
```

**受注フロー:**
```typescript
// src/services/order-shipping-service.ts

interface ShippingOrder {
  orderNumber: string;          // 受注番号
  customerName: string;         // 顧客名
  shippingAddress: Address;     // 配送先
  items: OrderItem[];           // 商品明細
  shippingMethod: string;       // 配送方法
  shippingDate?: Date;          // 出荷希望日
}

class OrderShippingService {
  // ネクストエンジンから受注データ取得
  async fetchPendingOrders(): Promise<ShippingOrder[]> {
    const orders = await this.nextEngineClient.searchOrders({
      status: 'pending_shipment',  // 出荷待ち
      limit: 100,
    });

    return orders.map((order) => this.transformToShippingOrder(order));
  }

  // オープンロジに出荷指示
  async createShippingInstruction(
    order: ShippingOrder
  ): Promise<string> {
    const response = await axios.post(
      `${this.openlogiConfig.endpoint}/shipping/instructions`,
      {
        warehouse_code: this.openlogiConfig.warehouseCode,
        order_number: order.orderNumber,
        customer: {
          name: order.customerName,
          postal_code: order.shippingAddress.postalCode,
          address: order.shippingAddress.fullAddress,
          tel: order.shippingAddress.tel,
        },
        items: order.items.map((item) => ({
          product_code: item.productCode,
          quantity: item.quantity,
        })),
        shipping_method: order.shippingMethod,
        desired_shipping_date: order.shippingDate,
      },
      {
        headers: {
          'X-API-Key': this.openlogiConfig.apiKey,
        },
      }
    );

    // 出荷指示ID（オープンロジ側の管理番号）
    return response.data.instruction_id;
  }

  // 出荷完了時の処理
  async handleShipmentCompleted(
    instructionId: string
  ): Promise<void> {
    // 1. オープンロジから追跡番号取得
    const tracking = await this.getTrackingNumber(instructionId);

    // 2. ネクストエンジンに追跡番号登録
    await this.nextEngineClient.updateOrder({
      order_number: tracking.orderNumber,
      tracking_number: tracking.trackingNumber,
      carrier_code: tracking.carrierCode,
      shipped_date: tracking.shippedDate,
      status: 'shipped',
    });

    // 3. 在庫数を更新
    await this.updateInventory(tracking.orderNumber);
  }

  // 追跡番号取得
  private async getTrackingNumber(
    instructionId: string
  ): Promise<TrackingInfo> {
    const response = await axios.get(
      `${this.openlogiConfig.endpoint}/shipping/instructions/${instructionId}`,
      {
        headers: {
          'X-API-Key': this.openlogiConfig.apiKey,
        },
      }
    );

    return {
      orderNumber: response.data.order_number,
      trackingNumber: response.data.tracking_number,
      carrierCode: response.data.carrier_code,
      shippedDate: new Date(response.data.shipped_at),
    };
  }
}
```

#### Phase 3: 在庫同期

```yaml
# 在庫同期設定
inventory_sync:
  # オープンロジ → ネクストエンジン
  direction: openlogi_to_nextengine
  schedule: "*/10 * * * *"      # 10分ごと
  sync_type: incremental        # 差分同期

  # 在庫反映ルール
  rules:
    sync_warehouse_stock: true  # 倉庫在庫を同期
    buffer_stock: 5             # 安全在庫（引かない在庫数）
    alert_threshold: 10         # アラート閾値
```

**実装例:**
```typescript
// src/services/inventory-sync-service.ts

class InventorySyncService {
  // オープンロジから在庫データ取得
  async syncInventoryFromOpenlogi(): Promise<SyncResult> {
    // 1. オープンロジから在庫データ取得
    const openlogiStock = await this.fetchOpenlogiInventory();

    // 2. ネクストエンジンの在庫を更新
    const results = await Promise.all(
      openlogiStock.map(async (stock) => {
        try {
          // 安全在庫を考慮
          const availableStock = Math.max(
            0,
            stock.quantity - this.config.bufferStock
          );

          await this.nextEngineClient.updateStock({
            product_code: stock.productCode,
            stock: availableStock,
          });

          // 在庫アラート
          if (availableStock <= this.config.alertThreshold) {
            await this.sendLowStockAlert(stock.productCode, availableStock);
          }

          return { product_code: stock.productCode, status: 'success' };
        } catch (error) {
          return { product_code: stock.productCode, status: 'failed', error };
        }
      })
    );

    return {
      total: openlogiStock.length,
      success: results.filter((r) => r.status === 'success').length,
      failed: results.filter((r) => r.status === 'failed').length,
    };
  }

  // オープンロジから在庫取得
  private async fetchOpenlogiInventory(): Promise<StockInfo[]> {
    const response = await axios.get(
      `${this.openlogiConfig.endpoint}/inventory`,
      {
        params: {
          warehouse_code: this.openlogiConfig.warehouseCode,
        },
        headers: {
          'X-API-Key': this.openlogiConfig.apiKey,
        },
      }
    );

    return response.data.stocks;
  }
}
```

---

## 3. Chrome自動操作設計

### 3.1 使用ツール

Claude Code の MCP 設定に含まれる以下のツールを使用：
- **Playwright** (`@playwright/mcp@latest`)
- **Chrome DevTools** (`chrome-devtools-mcp@latest`)

### 3.2 自動操作が必要なケース

APIで対応できない以下の操作をChromeモードで実行：

1. **認証・APIキー管理** ⭐ NEW
   - ネクストエンジンへのログイン
   - APIキーの新規発行
   - Client ID / Client Secret / Redirect URI の取得
   - アクセストークンの取得

2. **初期設定**
   - オープンロジアプリの有効化
   - API連携設定
   - 倉庫コード設定

3. **エラー対応**
   - 手動承認が必要な受注処理
   - API エラー時のフォールバック

4. **レポート取得**
   - 管理画面からのCSVダウンロード
   - グラフィカルなレポート確認

### 3.3 Playwright実装例

```typescript
// src/automation/next-engine-browser.ts
import { chromium, Page, Browser } from 'playwright';

interface NextEngineBrowserConfig {
  baseUrl: string;
  loginId: string;
  password: string;
  headless: boolean;
}

class NextEngineBrowser {
  private browser?: Browser;
  private page?: Page;

  constructor(private config: NextEngineBrowserConfig) {}

  // ブラウザ起動・ログイン
  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.config.headless,
    });

    this.page = await this.browser.newPage();

    // ネクストエンジンにログイン
    await this.login();
  }

  // ログイン処理
  private async login(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    await this.page.goto(`${this.config.baseUrl}/users/login`);

    // ログインフォーム入力
    await this.page.fill('input[name="login_id"]', this.config.loginId);
    await this.page.fill('input[name="password"]', this.config.password);

    // ログインボタンクリック
    await this.page.click('button[type="submit"]');

    // ログイン完了待機
    await this.page.waitForURL('**/main');
  }

  // オープンロジアプリの有効化
  async enableOpenlogiApp(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    // アプリ一覧ページへ移動
    await this.page.goto(`${this.config.baseUrl}/apps`);

    // オープンロジアプリを検索
    await this.page.fill('input[name="search"]', 'オープンロジ');
    await this.page.click('button[type="submit"]');

    // アプリ詳細ページへ
    await this.page.click('a:has-text("オープンロジ")');

    // 有効化ボタンをクリック
    const enableButton = await this.page.$('button:has-text("有効化")');
    if (enableButton) {
      await enableButton.click();
      await this.page.waitForSelector('text=有効化されました');
    }
  }

  // API連携設定
  async configureApiIntegration(config: {
    warehouseCode: string;
    apiKey: string;
  }): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    // オープンロジアプリ設定ページへ
    await this.page.goto(
      `${this.config.baseUrl}/apps/openlogi/settings`
    );

    // 倉庫コード入力
    await this.page.fill(
      'input[name="warehouse_code"]',
      config.warehouseCode
    );

    // APIキー入力
    await this.page.fill('input[name="api_key"]', config.apiKey);

    // 保存ボタンクリック
    await this.page.click('button:has-text("保存")');

    // 保存完了待機
    await this.page.waitForSelector('text=保存されました');
  }

  // 受注一覧から手動承認
  async approveOrders(orderNumbers: string[]): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    // 受注一覧ページへ
    await this.page.goto(`${this.config.baseUrl}/orders`);

    for (const orderNumber of orderNumbers) {
      // 受注検索
      await this.page.fill('input[name="order_number"]', orderNumber);
      await this.page.click('button:has-text("検索")');

      // チェックボックス選択
      await this.page.check(`input[value="${orderNumber}"]`);

      // 承認ボタンクリック
      await this.page.click('button:has-text("承認")');

      // 確認ダイアログ
      await this.page.click('button:has-text("OK")');

      // 処理完了待機
      await this.page.waitForSelector('text=承認されました');
    }
  }

  // CSVレポートダウンロード
  async downloadReport(reportType: string): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');

    // レポート画面へ移動
    await this.page.goto(`${this.config.baseUrl}/reports/${reportType}`);

    // ダウンロード開始
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.page.click('button:has-text("CSVダウンロード")'),
    ]);

    // ファイル保存
    const path = `./downloads/${reportType}_${Date.now()}.csv`;
    await download.saveAs(path);

    return path;
  }

  // ===== APIキー管理 ===== ⭐ NEW

  /**
   * APIキーを新規発行
   * @param appName アプリケーション名
   * @param redirectUri リダイレクトURI
   * @returns APIキー情報（Client ID, Client Secret, Redirect URI）
   */
  async generateApiKey(
    appName: string,
    redirectUri: string
  ): Promise<ApiCredentials> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('🔑 APIキー発行を開始します...');

    // システム設定ページへ移動
    await this.page.goto(`${this.config.baseUrl}/system/setting`);

    // API設定メニューをクリック
    await this.page.click('a:has-text("API設定")');

    // 新規アプリケーション登録ボタンをクリック
    await this.page.click('button:has-text("新規アプリケーション登録")');

    // アプリケーション情報を入力
    await this.page.fill('input[name="app_name"]', appName);
    await this.page.fill('input[name="redirect_uri"]', redirectUri);

    // 登録ボタンをクリック
    await this.page.click('button:has-text("登録")');

    // 登録完了を待機
    await this.page.waitForSelector('text=APIキーが発行されました');

    // 発行されたAPIキー情報を取得
    const clientId = await this.page.inputValue('input[name="client_id"]');
    const clientSecret = await this.page.inputValue(
      'input[name="client_secret"]'
    );

    console.log('✅ APIキーの発行が完了しました');

    // スクリーンショットを保存（記録用）
    await this.page.screenshot({
      path: `./screenshots/api-key-${Date.now()}.png`,
      fullPage: true,
    });

    return {
      clientId,
      clientSecret,
      redirectUri,
      appName,
      createdAt: new Date(),
    };
  }

  /**
   * 既存のAPIキー情報を取得
   * @param appName 取得したいアプリケーション名
   * @returns APIキー情報
   */
  async getApiCredentials(appName: string): Promise<ApiCredentials | null> {
    if (!this.page) throw new Error('Page not initialized');

    console.log(`🔍 APIキー情報を取得します: ${appName}`);

    // API設定ページへ移動
    await this.page.goto(`${this.config.baseUrl}/system/setting/api`);

    // アプリケーション一覧からターゲットを検索
    const appRow = await this.page.$(
      `tr:has-text("${appName}")`
    );

    if (!appRow) {
      console.log(`⚠️ アプリケーション "${appName}" が見つかりません`);
      return null;
    }

    // 詳細ボタンをクリック
    await appRow.click('button:has-text("詳細")');

    // APIキー情報を取得
    const clientId = await this.page.inputValue('input[name="client_id"]');
    const clientSecret = await this.page.inputValue(
      'input[name="client_secret"]'
    );
    const redirectUri = await this.page.inputValue(
      'input[name="redirect_uri"]'
    );

    console.log('✅ APIキー情報の取得が完了しました');

    return {
      clientId,
      clientSecret,
      redirectUri,
      appName,
      createdAt: new Date(),
    };
  }

  /**
   * OAuth認証フローを実行してアクセストークンを取得
   * @param credentials APIキー情報
   * @returns アクセストークン情報
   */
  async obtainAccessToken(
    credentials: ApiCredentials
  ): Promise<TokenResponse> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('🔐 OAuth認証フローを開始します...');

    // 認証URLを構築
    const authUrl = new URL(`${this.config.baseUrl}/api_v1_login_user/authorize`);
    authUrl.searchParams.set('client_id', credentials.clientId);
    authUrl.searchParams.set('redirect_uri', credentials.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', this.generateRandomState());

    // 認証ページへ移動
    await this.page.goto(authUrl.toString());

    // 承認ボタンをクリック
    await this.page.click('button:has-text("承認")');

    // リダイレクト先のURLを取得（認可コードを含む）
    await this.page.waitForURL(`${credentials.redirectUri}*`);
    const currentUrl = new URL(this.page.url());
    const authCode = currentUrl.searchParams.get('code');

    if (!authCode) {
      throw new Error('認可コードの取得に失敗しました');
    }

    console.log('✅ 認可コードを取得しました');

    // 認可コードをアクセストークンに交換（APIリクエスト）
    const tokenResponse = await this.exchangeCodeForToken(
      credentials.clientId,
      credentials.clientSecret,
      authCode,
      credentials.redirectUri
    );

    console.log('✅ アクセストークンの取得が完了しました');

    return tokenResponse;
  }

  /**
   * 認可コードをアクセストークンに交換
   * @private
   */
  private async exchangeCodeForToken(
    clientId: string,
    clientSecret: string,
    authCode: string,
    redirectUri: string
  ): Promise<TokenResponse> {
    const response = await axios.post(
      `${this.config.baseUrl}/api_v1_login_user/access_token`,
      {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: authCode,
        redirect_uri: redirectUri,
      }
    );

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      tokenType: response.data.token_type,
      obtainedAt: new Date(),
    };
  }

  /**
   * アクセストークンをリフレッシュ
   * @param refreshToken リフレッシュトークン
   * @param credentials APIキー情報
   * @returns 新しいアクセストークン情報
   */
  async refreshAccessToken(
    refreshToken: string,
    credentials: ApiCredentials
  ): Promise<TokenResponse> {
    console.log('🔄 アクセストークンをリフレッシュします...');

    const response = await axios.post(
      `${this.config.baseUrl}/api_v1_login_user/access_token`,
      {
        grant_type: 'refresh_token',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: refreshToken,
      }
    );

    console.log('✅ アクセストークンのリフレッシュが完了しました');

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      tokenType: response.data.token_type,
      obtainedAt: new Date(),
    };
  }

  /**
   * ランダムなstate値を生成（CSRF対策）
   * @private
   */
  private generateRandomState(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  // ブラウザ終了
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// ===== 型定義 =====

interface ApiCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  appName: string;
  createdAt: Date;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  obtainedAt: Date;
}
```

### 3.4 スキルコマンド実装

#### コマンド1: APIキー発行 ⭐ NEW

```bash
# commands/generate-api-key.sh
#!/bin/bash

# ネクストエンジンのAPIキーを新規発行

echo "🔑 Next Engine APIキー発行開始"

APP_NAME=${1:-"Claude Code Automation"}
REDIRECT_URI=${2:-"http://localhost:3000/callback"}

# TypeScriptスクリプト実行
npx tsx ~/.claude/skills/next-engine/scripts/generate-api-key.ts \
  --app-name "${APP_NAME}" \
  --redirect-uri "${REDIRECT_URI}" \
  --headless false

echo "✅ APIキー発行完了"
echo "📝 発行されたAPIキー情報は .env ファイルに保存されました"
```

```typescript
// scripts/generate-api-key.ts
import { NextEngineBrowser } from '../src/automation/next-engine-browser';
import { writeFileSync, appendFileSync } from 'fs';

async function main() {
  const args = process.argv.slice(2);
  const appName =
    args.find((arg) => arg.startsWith('--app-name='))?.split('=')[1] ||
    'Claude Code Automation';
  const redirectUri =
    args.find((arg) => arg.startsWith('--redirect-uri='))?.split('=')[1] ||
    'http://localhost:3000/callback';
  const headless =
    args.find((arg) => arg.startsWith('--headless='))?.split('=')[1] === 'true';

  const browser = new NextEngineBrowser({
    baseUrl: 'https://next-engine.net',
    loginId: process.env.NEXT_ENGINE_LOGIN_ID!,
    password: process.env.NEXT_ENGINE_PASSWORD!,
    headless,
  });

  try {
    // ブラウザ起動・ログイン
    console.log('ログイン中...');
    await browser.initialize();

    // APIキー発行
    console.log('APIキーを発行中...');
    const credentials = await browser.generateApiKey(appName, redirectUri);

    // OAuth認証フローでアクセストークン取得
    console.log('アクセストークンを取得中...');
    const token = await browser.obtainAccessToken(credentials);

    // .envファイルに保存
    const envContent = `
# Next Engine API Credentials (Generated: ${new Date().toISOString()})
NEXT_ENGINE_CLIENT_ID=${credentials.clientId}
NEXT_ENGINE_CLIENT_SECRET=${credentials.clientSecret}
NEXT_ENGINE_REDIRECT_URI=${credentials.redirectUri}
NEXT_ENGINE_ACCESS_TOKEN=${token.accessToken}
NEXT_ENGINE_REFRESH_TOKEN=${token.refreshToken}
`;

    appendFileSync('.env', envContent);

    // JSON形式でも保存（バックアップ）
    const jsonContent = {
      credentials: {
        ...credentials,
        createdAt: credentials.createdAt.toISOString(),
      },
      token: {
        ...token,
        obtainedAt: token.obtainedAt.toISOString(),
        expiresAt: new Date(
          token.obtainedAt.getTime() + token.expiresIn * 1000
        ).toISOString(),
      },
    };

    writeFileSync(
      `./api-credentials-${Date.now()}.json`,
      JSON.stringify(jsonContent, null, 2)
    );

    console.log('\n✅ APIキー情報:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`App Name:       ${credentials.appName}`);
    console.log(`Client ID:      ${credentials.clientId}`);
    console.log(`Client Secret:  ${credentials.clientSecret.slice(0, 10)}...`);
    console.log(`Redirect URI:   ${credentials.redirectUri}`);
    console.log(`Access Token:   ${token.accessToken.slice(0, 10)}...`);
    console.log(`Refresh Token:  ${token.refreshToken.slice(0, 10)}...`);
    console.log(`Expires In:     ${token.expiresIn}秒`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
```

#### コマンド2: アクセストークンリフレッシュ ⭐ NEW

```bash
# commands/refresh-token.sh
#!/bin/bash

# アクセストークンをリフレッシュ

echo "🔄 アクセストークンをリフレッシュします"

npx tsx ~/.claude/skills/next-engine/scripts/refresh-token.ts

echo "✅ トークンのリフレッシュが完了しました"
```

```typescript
// scripts/refresh-token.ts
import { NextEngineBrowser } from '../src/automation/next-engine-browser';
import { config } from 'dotenv';
import { appendFileSync } from 'fs';

config(); // .envファイルを読み込み

async function main() {
  const refreshToken = process.env.NEXT_ENGINE_REFRESH_TOKEN;
  const clientId = process.env.NEXT_ENGINE_CLIENT_ID;
  const clientSecret = process.env.NEXT_ENGINE_CLIENT_SECRET;
  const redirectUri = process.env.NEXT_ENGINE_REDIRECT_URI;

  if (!refreshToken || !clientId || !clientSecret || !redirectUri) {
    console.error('❌ エラー: .envファイルに必要な情報が不足しています');
    process.exit(1);
  }

  const browser = new NextEngineBrowser({
    baseUrl: 'https://next-engine.net',
    loginId: process.env.NEXT_ENGINE_LOGIN_ID!,
    password: process.env.NEXT_ENGINE_PASSWORD!,
    headless: true,
  });

  try {
    // トークンリフレッシュ
    const newToken = await browser.refreshAccessToken(refreshToken, {
      clientId,
      clientSecret,
      redirectUri,
      appName: 'Claude Code Automation',
      createdAt: new Date(),
    });

    // .envファイルを更新
    console.log('📝 .envファイルを更新中...');

    const envContent = `
# Refreshed: ${new Date().toISOString()}
NEXT_ENGINE_ACCESS_TOKEN=${newToken.accessToken}
NEXT_ENGINE_REFRESH_TOKEN=${newToken.refreshToken}
`;

    appendFileSync('.env', envContent);

    console.log('✅ 新しいアクセストークン:');
    console.log(`  ${newToken.accessToken.slice(0, 20)}...`);
    console.log(`  有効期限: ${newToken.expiresIn}秒`);
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
```

#### コマンド3: オープンロジセットアップ

```bash
# commands/openlogi-setup.sh
#!/bin/bash

# オープンロジ連携の初期設定をChromeモードで実行

echo "🚀 オープンロジ連携セットアップ開始"

# TypeScriptスクリプト実行
npx tsx ~/.claude/skills/next-engine/scripts/openlogi-setup.ts \
  --warehouse-code "${OPENLOGI_WAREHOUSE_CODE}" \
  --api-key "${OPENLOGI_API_KEY}" \
  --headless false

echo "✅ セットアップ完了"
```

```typescript
// scripts/openlogi-setup.ts
import { NextEngineBrowser } from '../src/automation/next-engine-browser';

async function main() {
  const args = process.argv.slice(2);
  const warehouseCode = args.find((arg) =>
    arg.startsWith('--warehouse-code=')
  )?.split('=')[1];
  const apiKey = args.find((arg) => arg.startsWith('--api-key='))?.split('=')[1];
  const headless =
    args.find((arg) => arg.startsWith('--headless='))?.split('=')[1] === 'true';

  if (!warehouseCode || !apiKey) {
    console.error('Error: --warehouse-code and --api-key are required');
    process.exit(1);
  }

  const browser = new NextEngineBrowser({
    baseUrl: 'https://next-engine.net',
    loginId: process.env.NEXT_ENGINE_LOGIN_ID!,
    password: process.env.NEXT_ENGINE_PASSWORD!,
    headless,
  });

  try {
    // ブラウザ起動・ログイン
    await browser.initialize();

    // オープンロジアプリ有効化
    console.log('オープンロジアプリを有効化中...');
    await browser.enableOpenlogiApp();

    // API連携設定
    console.log('API連携設定中...');
    await browser.configureApiIntegration({
      warehouseCode,
      apiKey,
    });

    console.log('✅ オープンロジ連携設定が完了しました');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
```

---

## 4. 自動化ワークフロー全体

### 4.1 日次バッチ処理

```yaml
# 日次バッチ設定
daily_batch:
  schedule: "0 2 * * *"  # 毎日AM2:00

  jobs:
    # 1. 商品マスタ同期
    - name: sync_product_master
      service: openlogi-sync
      method: syncProductMaster

    # 2. 在庫同期
    - name: sync_inventory
      service: inventory-sync
      method: syncInventoryFromOpenlogi

    # 3. 出荷完了チェック
    - name: check_shipped_orders
      service: order-shipping
      method: checkShippedOrders

    # 4. レポート生成
    - name: generate_report
      service: reporting
      method: generateDailyReport
```

### 4.2 リアルタイム処理

```yaml
# リアルタイム処理（Webhook）
webhook:
  # オープンロジからの出荷完了通知
  - event: shipment_completed
    endpoint: /webhooks/openlogi/shipment-completed
    handler: handleShipmentCompleted

  # ネクストエンジンからの新規受注通知
  - event: new_order
    endpoint: /webhooks/nextengine/new-order
    handler: createShippingInstruction
```

---

## 5. エラーハンドリング

### 5.1 API エラー時のフォールバック

```typescript
// src/lib/fallback-handler.ts

class FallbackHandler {
  async handleApiError(
    operation: string,
    error: Error
  ): Promise<void> {
    logger.error(`API Error in ${operation}:`, error);

    // Chrome自動操作にフォールバック
    if (this.isCriticalOperation(operation)) {
      logger.info('Falling back to browser automation');

      const browser = new NextEngineBrowser(this.browserConfig);
      await browser.initialize();

      try {
        await this.executeViaBrowser(browser, operation);
      } finally {
        await browser.close();
      }
    }
  }

  private isCriticalOperation(operation: string): boolean {
    const criticalOps = ['approve_order', 'update_tracking'];
    return criticalOps.includes(operation);
  }
}
```

---

## 6. モニタリング・アラート

### 6.1 監視項目

```yaml
monitoring:
  # API連携ステータス
  - metric: api_connection_status
    check_interval: 5m
    alert_threshold: 3_consecutive_failures

  # 在庫同期遅延
  - metric: inventory_sync_delay
    check_interval: 10m
    alert_threshold: 30m

  # 出荷指示エラー率
  - metric: shipping_instruction_error_rate
    check_interval: 1h
    alert_threshold: 5%

  # 追跡番号取得失敗
  - metric: tracking_number_fetch_failure
    check_interval: 1h
    alert_threshold: 2%
```

---

## 7. 参考資料

- [OPENLOGI - ネクストエンジン連携について](https://service.openlogi.com/openlogi_mag/next_engine_cooperation/)
- [OPENLOGI - ネクストエンジンAPI解説](https://service.openlogi.com/openlogi_mag/next_engine_api/)
- [OPENLOGI - ネクストエンジン連携LP](https://service.openlogi.com/nextengine-lp/)
- [Next Engine Apps - オープンロジ](https://base.next-engine.org/apps/503/detail/)

---

**作成日**: 2026-01-02
**バージョン**: 1.0.0
**対象システム**: ネクストエンジン + オープンロジ
