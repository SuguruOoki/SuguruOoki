/**
 * Next Engine API使用量管理サービス（Cloudflare Workers）
 *
 * このWorkerは、Next Engine APIの使用量をリモートで管理し、
 * ローカル・CI/CD環境から集中的にアクセス制限を管理します。
 */

export interface Env {
  // D1データベース（使用量を永続化）
  DB: D1Database;

  // API認証キー（環境変数）
  API_KEY: string;

  // 月間上限（環境変数で上書き可能）
  MONTHLY_LIMIT?: string;
}

interface ApiUsage {
  period: string;           // "2026-01"
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  by_endpoint: Record<string, number>;
  by_date: Record<string, number>;
  by_environment: {
    production: number;
    test: number;
  };
  last_updated: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS対応
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    // 認証チェック
    const authResult = await authenticate(request, env);
    if (!authResult.success) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ルーティング
      if (path === '/api/usage' && request.method === 'GET') {
        return await getUsage(env);
      }

      if (path === '/api/usage/check' && request.method === 'POST') {
        return await checkUsage(request, env);
      }

      if (path === '/api/usage/record' && request.method === 'POST') {
        return await recordUsage(request, env);
      }

      if (path === '/api/usage/reset' && request.method === 'POST') {
        return await resetUsage(env);
      }

      return jsonResponse({ error: 'Not Found' }, 404);
    } catch (error) {
      console.error('Error:', error);
      return jsonResponse({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  },
};

/**
 * 認証チェック
 */
async function authenticate(request: Request, env: Env): Promise<{ success: boolean }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return { success: false };
  }

  const token = authHeader.replace('Bearer ', '');
  if (token !== env.API_KEY) {
    return { success: false };
  }

  return { success: true };
}

/**
 * 使用状況を取得
 */
async function getUsage(env: Env): Promise<Response> {
  const currentPeriod = getCurrentPeriod();
  const usage = await loadUsage(env, currentPeriod);
  const limit = getMonthlyLimit(env);

  const remaining = limit - usage.total_calls;
  const usedPercent = (usage.total_calls / limit) * 100;

  return jsonResponse({
    period: currentPeriod,
    usage: {
      total_calls: usage.total_calls,
      successful_calls: usage.successful_calls,
      failed_calls: usage.failed_calls,
      production_calls: usage.by_environment.production,
      test_calls: usage.by_environment.test,
    },
    limits: {
      monthly_limit: limit,
      remaining: remaining,
      used_percent: usedPercent,
    },
    by_endpoint: usage.by_endpoint,
    by_date: usage.by_date,
    last_updated: usage.last_updated,
  });
}

/**
 * 使用可否をチェック
 */
async function checkUsage(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{
    environment?: 'production' | 'test';
  }>();

  const currentPeriod = getCurrentPeriod();
  const usage = await loadUsage(env, currentPeriod);
  const limit = getMonthlyLimit(env);

  const usedPercent = (usage.total_calls / limit) * 100;

  // テスト環境の場合は常に許可
  if (body.environment === 'test') {
    return jsonResponse({
      allowed: true,
      reason: 'Test environment calls are not counted',
      usage: {
        total_calls: usage.total_calls,
        remaining: limit - usage.total_calls,
        used_percent: usedPercent,
      },
    });
  }

  // 本番環境：90%でブロック
  const blockThreshold = 90;

  if (usedPercent >= blockThreshold) {
    return jsonResponse({
      allowed: false,
      reason: `API limit reached: ${usedPercent.toFixed(1)}% used (${usage.total_calls}/${limit} calls)`,
      usage: {
        total_calls: usage.total_calls,
        remaining: limit - usage.total_calls,
        used_percent: usedPercent,
      },
      threshold: blockThreshold,
    });
  }

  // 警告
  let warning = null;
  if (usedPercent >= 80) {
    warning = `⚠️ Warning: ${usedPercent.toFixed(1)}% API usage`;
  }

  return jsonResponse({
    allowed: true,
    warning: warning,
    usage: {
      total_calls: usage.total_calls,
      remaining: limit - usage.total_calls,
      used_percent: usedPercent,
    },
  });
}

/**
 * API使用を記録
 */
async function recordUsage(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{
    endpoint: string;
    success: boolean;
    environment: 'production' | 'test';
    timestamp?: string;
  }>();

  const currentPeriod = getCurrentPeriod();
  const usage = await loadUsage(env, currentPeriod);

  const today = new Date().toISOString().split('T')[0];

  // 本番環境のみカウント
  if (body.environment === 'production') {
    usage.total_calls++;
    if (body.success) {
      usage.successful_calls++;
    } else {
      usage.failed_calls++;
    }
  }

  // 環境別カウント（統計用）
  usage.by_environment[body.environment]++;

  // エンドポイント別
  usage.by_endpoint[body.endpoint] = (usage.by_endpoint[body.endpoint] || 0) + 1;

  // 日別
  usage.by_date[today] = (usage.by_date[today] || 0) + 1;

  usage.last_updated = new Date().toISOString();

  // 保存
  await saveUsage(env, currentPeriod, usage);

  const limit = getMonthlyLimit(env);
  const remaining = limit - usage.total_calls;
  const usedPercent = (usage.total_calls / limit) * 100;

  return jsonResponse({
    success: true,
    usage: {
      total_calls: usage.total_calls,
      remaining: remaining,
      used_percent: usedPercent,
    },
    environment: body.environment,
    counted: body.environment === 'production',
  });
}

/**
 * 使用状況をリセット
 */
async function resetUsage(env: Env): Promise<Response> {
  const currentPeriod = getCurrentPeriod();

  const newUsage: ApiUsage = {
    period: currentPeriod,
    total_calls: 0,
    successful_calls: 0,
    failed_calls: 0,
    by_endpoint: {},
    by_date: {},
    by_environment: {
      production: 0,
      test: 0,
    },
    last_updated: new Date().toISOString(),
  };

  await saveUsage(env, currentPeriod, newUsage);

  return jsonResponse({
    success: true,
    message: `Usage reset for period ${currentPeriod}`,
  });
}

/**
 * 使用状況を読み込み
 */
async function loadUsage(env: Env, period: string): Promise<ApiUsage> {
  const result = await env.DB
    .prepare('SELECT data FROM api_usage WHERE period = ?')
    .bind(period)
    .first<{ data: string }>();

  if (result) {
    return JSON.parse(result.data);
  }

  // 新規作成
  return {
    period,
    total_calls: 0,
    successful_calls: 0,
    failed_calls: 0,
    by_endpoint: {},
    by_date: {},
    by_environment: {
      production: 0,
      test: 0,
    },
    last_updated: new Date().toISOString(),
  };
}

/**
 * 使用状況を保存
 */
async function saveUsage(env: Env, period: string, usage: ApiUsage): Promise<void> {
  const data = JSON.stringify(usage);

  await env.DB
    .prepare(
      'INSERT INTO api_usage (period, data, updated_at) VALUES (?, ?, ?) ' +
      'ON CONFLICT(period) DO UPDATE SET data = ?, updated_at = ?'
    )
    .bind(period, data, new Date().toISOString(), data, new Date().toISOString())
    .run();
}

/**
 * 現在の期間（YYYY-MM）を取得
 */
function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * 月間上限を取得
 */
function getMonthlyLimit(env: Env): number {
  if (env.MONTHLY_LIMIT) {
    return parseInt(env.MONTHLY_LIMIT, 10);
  }
  return 1000; // デフォルト
}

/**
 * JSONレスポンスを返す
 */
function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/**
 * CORS対応
 */
function handleCORS(): Response {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
