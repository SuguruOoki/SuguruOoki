# ネクストエンジン APIキー発行 クイックスタートガイド

## 概要

Chrome自動操作を使って、ネクストエンジンのAPIキー発行からアクセストークン取得まで完全自動化します。

---

## 📋 前提条件

### 必要なもの
- ネクストエンジンのアカウント（ログインID、パスワード）
- Node.js v20+
- Playwright

### 環境変数の準備

まず、ログイン情報を `.env` ファイルに設定：

```bash
# .env
NEXT_ENGINE_LOGIN_ID=your_login_id
NEXT_ENGINE_PASSWORD=your_password
```

---

## 🚀 ステップ1: APIキー発行

### コマンド実行

```bash
# デフォルト設定で発行
bash commands/generate-api-key.sh

# カスタム設定で発行
bash commands/generate-api-key.sh "My App Name" "https://myapp.com/callback"
```

### 実行フロー

```
1. ネクストエンジンにログイン
   ↓
2. システム設定 → API設定へ移動
   ↓
3. 新規アプリケーション登録
   ↓
4. Client ID / Client Secret 発行
   ↓
5. OAuth認証フロー実行
   ↓
6. アクセストークン / リフレッシュトークン取得
   ↓
7. .env ファイルに自動保存
```

### 実行結果

コマンド実行後、以下が自動的に `.env` ファイルに追加されます：

```bash
# Next Engine API Credentials (Generated: 2026-01-02T12:00:00Z)
NEXT_ENGINE_CLIENT_ID=xxxxxxxxxxxxxx
NEXT_ENGINE_CLIENT_SECRET=yyyyyyyyyyyyyy
NEXT_ENGINE_REDIRECT_URI=http://localhost:3000/callback
NEXT_ENGINE_ACCESS_TOKEN=zzzzzzzzzzzzzz
NEXT_ENGINE_REFRESH_TOKEN=wwwwwwwwwwwwww
```

また、バックアップとして `api-credentials-{timestamp}.json` も作成されます：

```json
{
  "credentials": {
    "clientId": "xxxxxxxxxxxxxx",
    "clientSecret": "yyyyyyyyyyyyyy",
    "redirectUri": "http://localhost:3000/callback",
    "appName": "Claude Code Automation",
    "createdAt": "2026-01-02T12:00:00.000Z"
  },
  "token": {
    "accessToken": "zzzzzzzzzzzzzz",
    "refreshToken": "wwwwwwwwwwwwww",
    "expiresIn": 3600,
    "tokenType": "Bearer",
    "obtainedAt": "2026-01-02T12:00:00.000Z",
    "expiresAt": "2026-01-02T13:00:00.000Z"
  }
}
```

### スクリーンショット

APIキー発行画面のスクリーンショットが `./screenshots/` に保存されます：
- `api-key-{timestamp}.png`

---

## 🔄 ステップ2: アクセストークンのリフレッシュ

アクセストークンは **1時間で期限切れ** になります。期限切れ前に自動リフレッシュ：

### 手動リフレッシュ

```bash
bash commands/refresh-token.sh
```

### 自動リフレッシュ（cron設定）

```bash
# crontabに追加
# 毎時0分にトークンをリフレッシュ
0 * * * * cd /path/to/project && bash commands/refresh-token.sh
```

### 実装内での自動リフレッシュ

```typescript
// src/api/client.ts

class NextEngineClient {
  private async ensureValidToken(): Promise<void> {
    const tokenExpiresAt = new Date(this.config.tokenExpiresAt);
    const now = new Date();

    // 有効期限の5分前にリフレッシュ
    if (now >= new Date(tokenExpiresAt.getTime() - 5 * 60 * 1000)) {
      console.log('🔄 アクセストークンをリフレッシュします...');

      const newToken = await this.refreshAccessToken(
        this.config.refreshToken
      );

      // 環境変数を更新
      this.config.accessToken = newToken.accessToken;
      this.config.refreshToken = newToken.refreshToken;
      this.config.tokenExpiresAt = new Date(
        Date.now() + newToken.expiresIn * 1000
      );

      console.log('✅ アクセストークンがリフレッシュされました');
    }
  }

  async request(endpoint: string, params?: any): Promise<any> {
    // トークンの有効性を確認
    await this.ensureValidToken();

    // APIリクエスト実行
    return await this.http.post(endpoint, {
      access_token: this.config.accessToken,
      ...params,
    });
  }
}
```

---

## 🔐 セキュリティのベストプラクティス

### 1. 認証情報の保護

```bash
# .gitignore に追加
.env
.env.local
api-credentials-*.json
screenshots/
```

### 2. アクセス権限の最小化

ネクストエンジンAPI設定で、必要最小限の権限のみを付与：
- ✅ 商品情報の読み取り・更新
- ✅ 受注情報の読み取り・更新
- ✅ 在庫情報の読み取り・更新
- ❌ 不要な管理者権限は付与しない

### 3. トークンの定期ローテーション

```bash
# 月1回、新しいAPIキーを発行して切り替え
# 古いAPIキーは無効化
```

### 4. 本番環境では環境変数を暗号化

```bash
# AWS Secrets Manager、Google Cloud Secret Manager等を使用
# 平文での .env ファイル使用は避ける
```

---

## 🛠️ トラブルシューティング

### Q1. ログインできない

**原因:** ログインID/パスワードが間違っている

**対処:**
```bash
# .envファイルを確認
cat .env | grep NEXT_ENGINE_LOGIN

# 正しい情報で再設定
```

### Q2. APIキー発行画面が見つからない

**原因:** ネクストエンジンのUI変更

**対処:**
- Playwrightのセレクタを最新のUIに合わせて修正
- `--headless false` で実際の画面を確認

### Q3. OAuth認証がタイムアウトする

**原因:** リダイレクトURIが間違っている

**対処:**
```bash
# ローカル開発の場合
REDIRECT_URI="http://localhost:3000/callback"

# 本番環境の場合
REDIRECT_URI="https://your-domain.com/callback"
```

### Q4. アクセストークンが無効

**原因:** トークンが期限切れ

**対処:**
```bash
# トークンをリフレッシュ
bash commands/refresh-token.sh

# それでもダメなら再発行
bash commands/generate-api-key.sh
```

---

## 📖 API使用例

### 商品検索

```typescript
import { NextEngineClient } from './src/api/client';

const client = new NextEngineClient({
  clientId: process.env.NEXT_ENGINE_CLIENT_ID!,
  clientSecret: process.env.NEXT_ENGINE_CLIENT_SECRET!,
  redirectUri: process.env.NEXT_ENGINE_REDIRECT_URI!,
  accessToken: process.env.NEXT_ENGINE_ACCESS_TOKEN!,
  refreshToken: process.env.NEXT_ENGINE_REFRESH_TOKEN!,
});

// 商品検索
const products = await client.searchProducts({
  product_code: 'PROD-001',
  fields: ['product_name', 'price', 'stock'],
});

console.log(products);
```

### 受注検索

```typescript
// 出荷待ちの受注を取得
const orders = await client.searchOrders({
  status: 'pending_shipment',
  limit: 100,
});

for (const order of orders) {
  console.log(`受注番号: ${order.order_number}`);
  console.log(`顧客名: ${order.customer_name}`);
  console.log(`合計金額: ${order.total_amount}円`);
}
```

### 在庫更新

```typescript
// 在庫数を更新
await client.updateStock({
  product_code: 'PROD-001',
  stock: 100,
});

console.log('在庫を更新しました');
```

---

## 🔗 完全なワークフロー例

### 初回セットアップから運用まで

```bash
# === ステップ1: 初期設定 ===

# 1. ログイン情報を設定
cat > .env << EOF
NEXT_ENGINE_LOGIN_ID=your_login_id
NEXT_ENGINE_PASSWORD=your_password
EOF

# 2. APIキーを発行
bash commands/generate-api-key.sh "Production App" "https://myapp.com/callback"

# 3. オープンロジ連携を設定
export OPENLOGI_WAREHOUSE_CODE=WH001
export OPENLOGI_API_KEY=your_openlogi_key
bash commands/openlogi-setup.sh

# === ステップ2: 定期実行設定 ===

# 4. トークン自動リフレッシュを設定（cron）
crontab -e
# 以下を追加:
# 0 * * * * cd /path/to/project && bash commands/refresh-token.sh

# === ステップ3: 商品同期開始 ===

# 5. 商品マスタを同期
bash commands/sync-products.sh product-config.yaml

# 6. 在庫同期を開始
bash commands/update-inventory.sh inventory-config.yaml
```

---

## 📚 関連ドキュメント

- [ネクストエンジン × オープンロジ連携設計](./next-engine-openlogi-integration.md)
- [マルチモール対応ガイド](./next-engine-multi-mall-guide.md)
- [Next Engine Developer Network](https://developer.next-engine.com/)

---

## ⚠️ 重要な注意事項

### APIキーの管理

1. **絶対にGitにコミットしない**
   - `.env` ファイルは `.gitignore` に追加必須
   - 誤ってコミットした場合は即座にAPIキーを無効化

2. **定期的にローテーション**
   - 最低でも3ヶ月に1回は新しいAPIキーを発行
   - 古いAPIキーは無効化

3. **本番環境ではシークレット管理サービスを使用**
   - AWS Secrets Manager
   - Google Cloud Secret Manager
   - Azure Key Vault

### OAuth認証の理解

```
┌────────────┐
│  ユーザー  │
└─────┬──────┘
      │ 1. ログイン
      ↓
┌────────────────┐
│ ネクストエンジン│
│   認証画面     │
└─────┬──────────┘
      │ 2. 承認
      ↓
┌────────────────┐
│ 認可コード発行  │
└─────┬──────────┘
      │ 3. コード交換
      ↓
┌────────────────┐
│アクセストークン │
│リフレッシュトークン│
└────────────────┘
```

---

**作成日**: 2026-01-02
**バージョン**: 1.0.0
**対象**: ネクストエンジン API v1
