# Next Engine 認証Worker × API使用量管理Worker 統合ガイド

このガイドでは、別のCloudflare Workerで実装した認証トークン更新サービスと、API使用量管理Workerを連携させる方法を説明します。

## 概要

```
┌────────────────────────┐
│ Next Engine 認証Worker  │
│ (next-engine-auth)     │
│                        │
│ - トークン自動更新     │
│ - /refresh エンドポイント│
└───────────┬────────────┘
            │
            │ ① Next Engine APIコール
            │    /api_v1_login_company/info
            ↓
┌────────────────────────┐
│ Next Engine API        │
└───────────┬────────────┘
            │
            │ ② APIコール後、使用量を記録
            ↓
┌────────────────────────┐
│ API使用量管理Worker     │
│ (next-engine-api-manager)│
│                        │
│ - POST /api/usage/record│
└────────────────────────┘
```

## 統合ポイント

認証Workerが以下のタイミングでNext Engine APIを呼び出す際、API使用量を記録する必要があります：

1. **トークン更新時** (`/api_v1_login_company/info`)
2. **その他のNext Engine API呼び出し**（存在する場合）

## 認証Worker側の実装

### 1. 環境変数の設定

認証Workerの `wrangler.toml` に以下を追加：

```toml
# wrangler.toml (next-engine-auth)

[vars]
# API使用量管理WorkerのURL
USAGE_MANAGER_URL = "https://next-engine-api-manager.YOUR-SUBDOMAIN.workers.dev"

# 環境（production または test）
NEXT_ENGINE_ENV = "production"

# シークレット（wrangler secret putで設定）
# USAGE_MANAGER_API_KEY = "設定必要"
```

### 2. API Keyの設定

```bash
# 認証Workerのディレクトリで実行
cd /path/to/next-engine-auth

# API使用量管理WorkerのAPI Keyを設定
wrangler secret put USAGE_MANAGER_API_KEY
# プロンプトで、api-usage-managerで設定したのと同じAPI Keyを入力
```

### 3. TypeScript実装例

認証Workerのソースコードに以下のコードを追加します：

#### 3-1. API使用量記録関数

```typescript
// src/usage-tracker.ts

interface Env {
  USAGE_MANAGER_URL: string;
  USAGE_MANAGER_API_KEY: string;
  NEXT_ENGINE_ENV: string;
}

/**
 * API使用量管理Workerに使用を記録
 */
export async function recordApiUsage(
  env: Env,
  endpoint: string,
  success: boolean
): Promise<void> {
  try {
    const response = await fetch(`${env.USAGE_MANAGER_URL}/api/usage/record`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.USAGE_MANAGER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint,
        success,
        environment: env.NEXT_ENGINE_ENV || 'production',
      }),
    });

    if (!response.ok) {
      console.error('Failed to record API usage:', await response.text());
      // エラーでも処理は継続（使用量記録の失敗でメイン処理を止めない）
    } else {
      const result = await response.json();
      console.log(`✅ API使用記録: ${endpoint}`);
      console.log(`📊 使用状況: ${result.usage.used_percent.toFixed(1)}% (${result.usage.total_calls}回)`);
      console.log(`カウント: ${result.counted ? 'あり' : 'なし (テスト環境)'}`);
    }
  } catch (error) {
    console.error('Error recording API usage:', error);
    // エラーでも処理は継続
  }
}

/**
 * 実行前に使用可能かチェック
 */
export async function checkApiUsageLimit(env: Env): Promise<boolean> {
  try {
    const response = await fetch(`${env.USAGE_MANAGER_URL}/api/usage/check`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.USAGE_MANAGER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        environment: env.NEXT_ENGINE_ENV || 'production',
      }),
    });

    const result = await response.json();

    if (!result.allowed) {
      console.error(`🛑 ${result.reason}`);
      return false;
    }

    if (result.warning) {
      console.warn(result.warning);
    }

    return true;
  } catch (error) {
    console.error('Error checking API usage limit:', error);
    // チェック失敗時は実行を許可（可用性優先）
    return true;
  }
}
```

#### 3-2. トークン更新処理に統合

既存の `/refresh` エンドポイントを修正：

```typescript
// src/index.ts

import { recordApiUsage, checkApiUsageLimit } from './usage-tracker';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/refresh') {
      return handleRefresh(request, env);
    }

    // ... 他のエンドポイント
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('🔄 Scheduled token refresh triggered');
    await refreshTokens(env);
  },
};

async function handleRefresh(request: Request, env: Env): Promise<Response> {
  try {
    // 1. API使用可能かチェック
    const canProceed = await checkApiUsageLimit(env);
    if (!canProceed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'API limit reached. Cannot refresh tokens.',
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. トークンを更新
    const result = await refreshTokens(env);

    // 3. API使用を記録（成功/失敗どちらも記録）
    await recordApiUsage(
      env,
      'api_v1_login_company/info',
      result.success
    );

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // エラー時も記録
    await recordApiUsage(env, 'api_v1_login_company/info', false);
    throw error;
  }
}

async function refreshTokens(env: Env): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    // 既存のKVからトークンを取得
    const accessToken = await env.TOKENS.get('access_token');
    const refreshToken = await env.TOKENS.get('refresh_token');

    if (!accessToken || !refreshToken) {
      return {
        success: false,
        error: 'No tokens found',
      };
    }

    // Next Engine APIにトークン更新リクエスト
    const response = await fetch(
      'https://api.next-engine.org/api_v1_login_company/info',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          access_token: accessToken,
          refresh_token: refreshToken,
        }),
      }
    );

    const data = await response.json();

    if (data.result === 'success' && data.data.access_token) {
      // 新しいトークンをKVに保存
      await env.TOKENS.put('access_token', data.data.access_token);
      await env.TOKENS.put('refresh_token', data.data.refresh_token);
      await env.TOKENS.put('updated_at', new Date().toISOString());

      return {
        success: true,
        message: 'Tokens refreshed successfully',
      };
    } else {
      return {
        success: false,
        error: data.message || 'Token refresh failed',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

#### 3-3. Cron（スケジュール実行）にも統合

```typescript
async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  console.log('🔄 Scheduled token refresh triggered');

  try {
    // 1. API使用可能かチェック
    const canProceed = await checkApiUsageLimit(env);
    if (!canProceed) {
      console.error('⚠️ API limit reached. Skipping scheduled refresh.');
      return;
    }

    // 2. トークンを更新
    const result = await refreshTokens(env);

    // 3. API使用を記録
    await recordApiUsage(
      env,
      'api_v1_login_company/info',
      result.success
    );

    if (result.success) {
      console.log('✅ Scheduled token refresh completed');
    } else {
      console.error('❌ Scheduled token refresh failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Scheduled token refresh error:', error);
    await recordApiUsage(env, 'api_v1_login_company/info', false);
  }
}
```

### 4. デプロイ

```bash
cd /path/to/next-engine-auth

# 環境変数の確認
wrangler secret list

# デプロイ
wrangler deploy
```

## 動作確認

### 1. 手動リフレッシュのテスト

```bash
curl https://next-engine-auth.suguru-ohki.workers.dev/refresh
```

**期待される出力:**
```json
{
  "success": true,
  "message": "Tokens refreshed successfully"
}
```

認証Workerのログには以下が表示されるはずです：
```
✅ API使用記録: api_v1_login_company/info
📊 使用状況: 1.0% (10回)
カウント: あり
```

### 2. API使用状況の確認

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://next-engine-api-manager.YOUR-SUBDOMAIN.workers.dev/api/usage
```

**期待される出力:**
```json
{
  "period": "2026-01",
  "usage": {
    "total_calls": 10,
    "successful_calls": 10,
    "failed_calls": 0,
    "production_calls": 10,
    "test_calls": 0
  },
  "by_endpoint": {
    "api_v1_login_company/info": 10
  }
}
```

### 3. Cronスケジュールの確認

```bash
# Cronトリガーをテスト
wrangler tail next-engine-auth --format=pretty
```

1日2回（UTC 0:00 と 12:00）に自動実行され、その度にAPI使用量が記録されるはずです。

## トラブルシューティング

### API使用量が記録されない

**原因1: API Keyが間違っている**

```bash
# 認証Workerで設定されているシークレットを確認
wrangler secret list

# API Keyを再設定
wrangler secret put USAGE_MANAGER_API_KEY
```

**原因2: USAGE_MANAGER_URLが間違っている**

```bash
# wrangler.tomlを確認
cat wrangler.toml | grep USAGE_MANAGER_URL
```

**原因3: API使用量管理Workerがデプロイされていない**

```bash
# API使用量管理Workerの状態を確認
curl https://next-engine-api-manager.YOUR-SUBDOMAIN.workers.dev/api/usage
```

### 90%到達時の挙動

API使用量が90%に達すると、`checkApiUsageLimit()` が `false` を返し、トークン更新がスキップされます：

```
🛑 API limit reached: 91.0% used (910/1000 calls)
⚠️ API limit reached. Skipping scheduled refresh.
```

この場合、手動でAPI使用量をリセットする必要があります：

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  https://next-engine-api-manager.YOUR-SUBDOMAIN.workers.dev/api/usage/reset
```

## ベストプラクティス

### 1. エラーハンドリング

API使用量記録の失敗でメイン処理（トークン更新）を止めないようにします：

```typescript
try {
  await recordApiUsage(env, endpoint, success);
} catch (error) {
  console.error('Failed to record API usage, but continuing:', error);
  // メイン処理は継続
}
```

### 2. テスト環境の活用

開発時は `NEXT_ENGINE_ENV=test` を設定してテスト環境で動作確認：

```toml
[env.staging]
name = "next-engine-auth-staging"

[env.staging.vars]
NEXT_ENGINE_ENV = "test"
USAGE_MANAGER_URL = "https://next-engine-api-manager-staging.YOUR-SUBDOMAIN.workers.dev"
```

テスト環境のAPIコールはカウントされないため、安全にテストできます。

### 3. ログの監視

定期的にログを確認してAPI使用状況を把握：

```bash
# リアルタイムログ
wrangler tail next-engine-auth

# 特定期間のログ（Cloudflare Dashboard）
# https://dash.cloudflare.com/ → Workers → next-engine-auth → Logs
```

## まとめ

認証Workerとの統合により：

- ✅ トークン更新時のAPIコールが自動的にカウントされる
- ✅ 1日2回のCron実行も記録される（月60回）
- ✅ 90%到達時に自動ブロックされ、課金を防止
- ✅ テスト環境のコールはカウント対象外
- ✅ 複数のWorkerから同じAPI使用状況を共有

**月間API使用量の想定:**
- トークン自動更新: 60回/月（1日2回 × 30日）
- 手動リフレッシュ: 必要に応じて
- その他のNext Engine APIコール: 残り940回

これで、すべてのNext Engine APIコールが一元管理され、課金リスクを回避できます。
