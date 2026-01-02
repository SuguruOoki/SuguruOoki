# ネクストエンジン設定自動化スキル 実装計画書

## 1. プロジェクト概要

### 目標
Claude Codeのスキルとして、ネクストエンジンのEC設定を自動化するツールを実装する。

### スコープ
- **Phase 1（MVP）**: 商品マスタの同期機能
- **Phase 2**: 在庫管理機能
- **Phase 3**: 発送・配送設定機能

### スケジュール
- **Phase 1**: 2週間（Week 1-2）
- **Phase 2**: 1週間（Week 3）
- **Phase 3**: 1週間（Week 4）
- **テスト・リリース**: 1週間（Week 5）

---

## 2. 技術スタック

### 言語・フレームワーク
- **TypeScript**: v5.3+
- **Node.js**: v20+
- **tsx**: TypeScript実行環境
- **Zod**: バリデーション
- **Axios**: HTTP クライアント

### 開発ツール
- **Vitest**: テストフレームワーク
- **ESLint**: 静的解析
- **Prettier**: コードフォーマッター
- **dotenv**: 環境変数管理

### CI/CD
- **GitHub Actions**: テスト自動化
- **npm**: パッケージ管理

---

## 3. ディレクトリ構造

```
~/.claude/skills/next-engine/
├── SKILL.md                         # スキル定義（ユーザー向けドキュメント）
├── README.md                        # 開発者向けREADME
├── package.json                     # 依存関係定義
├── tsconfig.json                    # TypeScript設定
├── .env.example                     # 環境変数テンプレート
│
├── commands/                        # 実行可能コマンド
│   ├── sync-products.sh             # 商品マスタ同期
│   ├── update-inventory.sh          # 在庫更新
│   └── configure-shipping.sh        # 配送設定
│
├── templates/                       # 設定ファイルテンプレート
│   ├── product-config.yaml
│   ├── inventory-config.yaml
│   └── shipping-config.yaml
│
├── src/                             # ソースコード
│   ├── index.ts                     # エントリーポイント
│   │
│   ├── api/                         # API関連
│   │   ├── client.ts                # Next Engine APIクライアント
│   │   ├── auth.ts                  # 認証処理
│   │   ├── endpoints.ts             # エンドポイント定義
│   │   └── types.ts                 # API型定義
│   │
│   ├── services/                    # ビジネスロジック
│   │   ├── product-service.ts       # 商品マスタサービス
│   │   ├── inventory-service.ts     # 在庫管理サービス
│   │   └── shipping-service.ts      # 配送設定サービス
│   │
│   ├── loaders/                     # データローダー
│   │   ├── csv-loader.ts            # CSV読み込み
│   │   ├── json-loader.ts           # JSON読み込み
│   │   └── db-loader.ts             # DB読み込み
│   │
│   ├── processors/                  # データ処理
│   │   ├── mapper.ts                # データマッピング
│   │   ├── validator.ts             # バリデーション
│   │   └── transformer.ts           # データ変換
│   │
│   ├── lib/                         # ユーティリティ
│   │   ├── logger.ts                # ロガー
│   │   ├── error-handler.ts         # エラーハンドリング
│   │   ├── retry.ts                 # リトライ処理
│   │   └── rate-limiter.ts          # レート制限
│   │
│   ├── config/                      # 設定管理
│   │   ├── index.ts                 # 設定読み込み
│   │   └── schema.ts                # 設定スキーマ（Zod）
│   │
│   └── types/                       # 型定義
│       ├── config.ts                # 設定ファイル型
│       ├── models.ts                # ドメインモデル型
│       └── index.ts                 # 型エクスポート
│
├── scripts/                         # 実行スクリプト
│   ├── product-sync.ts              # 商品同期メインスクリプト
│   ├── inventory-sync.ts            # 在庫同期メインスクリプト
│   └── shipping-sync.ts             # 配送設定メインスクリプト
│
├── tests/                           # テスト
│   ├── unit/                        # 単体テスト
│   │   ├── api/
│   │   ├── services/
│   │   └── lib/
│   ├── integration/                 # 統合テスト
│   └── fixtures/                    # テストデータ
│
└── docs/                            # ドキュメント
    ├── API_REFERENCE.md
    ├── CONFIG_GUIDE.md
    ├── TROUBLESHOOTING.md
    └── CHANGELOG.md
```

---

## 4. Phase 1: MVP実装（商品マスタ同期）

### 4.1 実装タスク

#### Week 1: 基盤構築

**Day 1-2: プロジェクトセットアップ**
- [ ] `package.json` 作成
- [ ] TypeScript環境構築
- [ ] ESLint/Prettier設定
- [ ] ディレクトリ構造作成
- [ ] `.env.example` 作成

**Day 3-4: API クライアント実装**
- [ ] `src/api/client.ts` - HTTPクライアント実装
- [ ] `src/api/auth.ts` - OAuth認証フロー実装
- [ ] `src/api/endpoints.ts` - エンドポイント定義
- [ ] `src/api/types.ts` - API型定義

**Day 5: エラーハンドリング・ユーティリティ**
- [ ] `src/lib/error-handler.ts` - エラークラス実装
- [ ] `src/lib/logger.ts` - ロガー実装
- [ ] `src/lib/retry.ts` - リトライ処理実装
- [ ] `src/lib/rate-limiter.ts` - レート制限実装

#### Week 2: 商品同期機能実装

**Day 1-2: データローダー**
- [ ] `src/loaders/csv-loader.ts` - CSV読み込み
- [ ] `src/loaders/json-loader.ts` - JSON読み込み
- [ ] `src/processors/mapper.ts` - データマッピング

**Day 3-4: 商品サービス**
- [ ] `src/services/product-service.ts` - 商品CRUD処理
- [ ] バッチ処理実装
- [ ] エラーハンドリング統合

**Day 5: 設定・実行スクリプト**
- [ ] `src/config/schema.ts` - Zodスキーマ定義
- [ ] `scripts/product-sync.ts` - メインスクリプト
- [ ] `commands/sync-products.sh` - シェルコマンド
- [ ] `templates/product-config.yaml` - テンプレート作成

### 4.2 コア実装例

#### API クライアント

```typescript
// src/api/client.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { RateLimiter } from '../lib/rate-limiter';
import { withRetry } from '../lib/retry';
import { Logger } from '../lib/logger';

export class NextEngineClient {
  private http: AxiosInstance;
  private rateLimiter: RateLimiter;
  private logger: Logger;
  private accessToken?: string;

  constructor(
    private config: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      accessToken?: string;
      refreshToken?: string;
    }
  ) {
    this.http = axios.create({
      baseURL: 'https://api.next-engine.org/api_v1_',
      timeout: 30000,
    });

    this.rateLimiter = new RateLimiter({ requestsPerMinute: 60 });
    this.logger = new Logger({ level: 'info' });
    this.accessToken = config.accessToken;
  }

  async request<T>(
    endpoint: string,
    params?: Record<string, any>
  ): Promise<T> {
    await this.rateLimiter.waitForSlot();

    return withRetry(async () => {
      const response = await this.http.post(endpoint, {
        access_token: this.accessToken,
        ...params,
      });

      return response.data;
    });
  }

  // 商品検索
  async searchProducts(params: SearchParams): Promise<Product[]> {
    const response = await this.request<SearchResponse>(
      'receiveorder/product/search',
      params
    );
    return response.data;
  }

  // 商品更新
  async updateProduct(productId: string, data: ProductUpdateData): Promise<void> {
    await this.request('receiveorder/product/update', {
      product_id: productId,
      ...data,
    });
  }
}
```

#### 商品サービス

```typescript
// src/services/product-service.ts
import { NextEngineClient } from '../api/client';
import { Logger } from '../lib/logger';
import { ProductMapper } from '../processors/mapper';

export class ProductService {
  constructor(
    private client: NextEngineClient,
    private mapper: ProductMapper,
    private logger: Logger
  ) {}

  async syncProducts(
    sourceData: SourceProduct[],
    options: SyncOptions
  ): Promise<SyncResult> {
    const results: SyncResult = {
      total: sourceData.length,
      success: 0,
      failed: 0,
      errors: [],
    };

    // バッチ処理
    const batches = this.createBatches(sourceData, options.batchSize);

    for (const [index, batch] of batches.entries()) {
      this.logger.info(`Processing batch ${index + 1}/${batches.length}`);

      for (const item of batch) {
        try {
          const mappedData = this.mapper.map(item);

          if (options.updateMode === 'upsert') {
            // 既存確認
            const existing = await this.client.searchProducts({
              product_code: item.code,
            });

            if (existing.length > 0) {
              await this.client.updateProduct(existing[0].id, mappedData);
            } else {
              await this.client.createProduct(mappedData);
            }
          }

          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            item: item.code,
            error: error.message,
          });

          if (options.errorHandling === 'stop') {
            throw error;
          }
        }
      }
    }

    return results;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}
```

#### メインスクリプト

```typescript
// scripts/product-sync.ts
import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { NextEngineClient } from '../src/api/client';
import { ProductService } from '../src/services/product-service';
import { CSVLoader } from '../src/loaders/csv-loader';
import { ProductMapper } from '../src/processors/mapper';
import { Logger } from '../src/lib/logger';
import { validateProductConfig } from '../src/config/schema';

async function main() {
  const args = process.argv.slice(2);
  const configPath = args.find((arg) => arg.startsWith('--config='))?.split('=')[1];

  if (!configPath) {
    console.error('Error: --config option is required');
    process.exit(1);
  }

  // 設定ファイル読み込み
  const configFile = readFileSync(configPath, 'utf-8');
  const config = parse(configFile);
  const validatedConfig = validateProductConfig(config);

  // 初期化
  const logger = new Logger(validatedConfig.logging);
  const client = new NextEngineClient(validatedConfig.api);
  const mapper = new ProductMapper(validatedConfig.products.mapping);
  const service = new ProductService(client, mapper, logger);

  // データ読み込み
  const loader = new CSVLoader(validatedConfig.products.source);
  const sourceData = await loader.load();

  logger.info(`Loaded ${sourceData.length} products from source`);

  // 同期実行
  const result = await service.syncProducts(
    sourceData,
    validatedConfig.products.options
  );

  // 結果レポート
  logger.info('Sync completed', {
    total: result.total,
    success: result.success,
    failed: result.failed,
  });

  if (result.failed > 0) {
    logger.error('Errors occurred:', result.errors);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

---

## 5. Phase 2: 在庫管理機能（Week 3）

### 実装タスク

**Day 1-2: 在庫サービス実装**
- [ ] `src/services/inventory-service.ts`
- [ ] 在庫検索API統合
- [ ] 在庫更新API統合

**Day 3-4: スケジュール実行・アラート**
- [ ] cron設定対応
- [ ] アラート通知実装（Email/Slack）
- [ ] 倉庫別在庫管理

**Day 5: テスト・ドキュメント**
- [ ] 単体テスト作成
- [ ] 統合テスト実行
- [ ] ドキュメント更新

---

## 6. Phase 3: 発送・配送設定（Week 4）

### 実装タスク

**Day 1-2: 配送サービス実装**
- [ ] `src/services/shipping-service.ts`
- [ ] 配送業者API連携
- [ ] 送り状発行機能

**Day 3-4: 自動化機能**
- [ ] 追跡番号自動登録
- [ ] 出荷通知機能
- [ ] ステータス更新自動化

**Day 5: 最終テスト**
- [ ] E2Eテスト実行
- [ ] パフォーマンステスト
- [ ] セキュリティチェック

---

## 7. テスト計画

### 7.1 単体テスト

```typescript
// tests/unit/services/product-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductService } from '../../../src/services/product-service';
import { NextEngineClient } from '../../../src/api/client';

describe('ProductService', () => {
  let service: ProductService;
  let mockClient: NextEngineClient;

  beforeEach(() => {
    mockClient = {
      searchProducts: vi.fn(),
      updateProduct: vi.fn(),
      createProduct: vi.fn(),
    } as any;

    service = new ProductService(mockClient, mapper, logger);
  });

  it('should sync products successfully', async () => {
    const sourceData = [
      { code: 'PROD-001', name: 'Product 1', price: 1000 },
    ];

    mockClient.searchProducts.mockResolvedValue([]);
    mockClient.createProduct.mockResolvedValue({ success: true });

    const result = await service.syncProducts(sourceData, {
      updateMode: 'upsert',
      batchSize: 100,
      errorHandling: 'skip',
      dryRun: false,
    });

    expect(result.success).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('should handle errors gracefully', async () => {
    const sourceData = [
      { code: 'INVALID', name: '', price: -100 },
    ];

    const result = await service.syncProducts(sourceData, {
      updateMode: 'create',
      batchSize: 100,
      errorHandling: 'skip',
      dryRun: false,
    });

    expect(result.failed).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
```

### 7.2 統合テスト

テストは Bash ツールを使用して実行します。

---

## 8. デプロイ・リリース

### 8.1 リリースチェックリスト

- [ ] すべてのテストがパス
- [ ] ドキュメントが最新
- [ ] 設定ファイルテンプレート準備
- [ ] `.env.example` 完備
- [ ] CHANGELOG.md 更新
- [ ] バージョンタグ付与

### 8.2 インストール手順

```bash
# スキルディレクトリ作成
mkdir -p ~/.claude/skills/next-engine
cd ~/.claude/skills/next-engine

# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
# .env を編集して API 認証情報を設定

# テスト実行
npm test

# 設定ファイル作成
cp templates/product-config.yaml ./my-product-config.yaml
# my-product-config.yaml を編集

# 実行
bash commands/sync-products.sh my-product-config.yaml
```

---

## 9. 運用・保守

### 9.1 ログ監視
- ログファイルの定期確認
- エラー率のモニタリング
- パフォーマンスメトリクス収集

### 9.2 定期メンテナンス
- API仕様変更の追跡
- 依存パッケージの更新
- セキュリティパッチ適用

### 9.3 トラブルシューティング
- エラーログの分析手順
- よくある問題のFAQ作成
- サポート連絡先の明記

---

## 10. 成功指標（KPI）

### 10.1 機能指標
- 商品同期成功率: 95%以上
- エラー発生率: 5%未満
- 処理時間: 1000件あたり5分以内

### 10.2 運用指標
- ドキュメント完成度: 100%
- テストカバレッジ: 80%以上
- バグ修正時間: 平均24時間以内

---

## 11. リスク管理

### 11.1 技術リスク

| リスク | 影響度 | 対策 |
|--------|--------|------|
| API仕様変更 | 高 | 定期的な仕様確認、バージョン管理 |
| レート制限超過 | 中 | バッチサイズ調整、リトライ処理 |
| データ不整合 | 高 | トランザクション管理、ロールバック |

### 11.2 運用リスク

| リスク | 影響度 | 対策 |
|--------|--------|------|
| 設定ミス | 中 | バリデーション強化、dry-runモード |
| 認証エラー | 中 | トークン自動更新、エラー通知 |
| データ損失 | 高 | バックアップ取得、復元手順整備 |

---

## 12. 次のステップ

### Phase 4 以降の拡張計画

1. **受注処理自動化**
   - 受注ステータス更新
   - 伝票分割・結合
   - 決済連携

2. **分析・レポート機能**
   - 売上集計
   - 在庫分析
   - パフォーマンスレポート

3. **外部連携**
   - EC モール連携（楽天、Amazon等）
   - 会計ソフト連携
   - CRM連携

---

**作成日**: 2026-01-02
**バージョン**: 1.0.0
**ステータス**: 実装準備完了
