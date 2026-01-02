# /user:next-engine-setup - 初期セットアップコマンド

## 概要
ネクストエンジン連携の初期セットアップを行うコマンドです。API認証、設定ファイルの生成、接続テストを実行します。

## 使用方法
```
/user:next-engine-setup [オプション]
```

## 実行フロー

### 1. 認証情報の確認
- 環境変数のチェック
- API認証情報の入力（未設定の場合）
- OAuth認証フローの実行

### 2. 設定ファイル生成
- product-config.yaml
- inventory-config.yaml
- shipping-config.yaml
- 各テンプレートをプロジェクトにコピー

### 3. 接続テスト
- Next Engine API 接続確認
- 商品マスタ取得テスト
- 在庫API取得テスト

### 4. モール連携設定
- 連携モールの確認
- 商品コードマッピングの設定
- 在庫連携方式の選択

## 必要な環境変数

```bash
# .env または環境変数に設定
NEXT_ENGINE_CLIENT_ID=your_client_id
NEXT_ENGINE_CLIENT_SECRET=your_client_secret
NEXT_ENGINE_REDIRECT_URI=https://your-app.com/callback

# OAuth認証後に取得
NEXT_ENGINE_ACCESS_TOKEN=your_access_token
NEXT_ENGINE_REFRESH_TOKEN=your_refresh_token
```

## セットアップ手順

### Step 1: Developer登録
1. [Next Engine Developer Network](https://developer.next-engine.com/) にアクセス
2. アプリケーション登録
3. Client ID / Client Secret を取得

### Step 2: 環境変数設定
```bash
# .env ファイルに追加
NEXT_ENGINE_CLIENT_ID=xxxxx
NEXT_ENGINE_CLIENT_SECRET=xxxxx
NEXT_ENGINE_REDIRECT_URI=https://your-app.com/callback
```

### Step 3: OAuth認証
```bash
/user:next-engine-setup --auth
```
ブラウザが開き、Next Engineにログイン後、トークンを取得

### Step 4: 設定ファイル生成
```bash
/user:next-engine-setup --init
```
プロジェクトルートに設定ファイルが生成されます

### Step 5: 接続テスト
```bash
/user:next-engine-setup --test
```
API接続を確認

## オプション

| オプション | 説明 |
|-----------|------|
| --auth | OAuth認証のみ実行 |
| --init | 設定ファイル生成のみ |
| --test | 接続テストのみ |
| --malls | モール連携設定 |
| --all | 全てのステップを実行（デフォルト） |

## 出力例

```
🔧 Next Engine 初期セットアップ

📋 Step 1: 認証情報確認
  - Client ID: ✅ 設定済み
  - Client Secret: ✅ 設定済み
  - Redirect URI: ✅ 設定済み

🔐 Step 2: OAuth認証
  認証URL: https://api.next-engine.org/api_neauth?client_id=xxx...
  ブラウザで認証してください...

  ✅ 認証成功
  - Access Token: 取得済み
  - Refresh Token: 取得済み

📁 Step 3: 設定ファイル生成
  - ./product-config.yaml: 作成完了
  - ./inventory-config.yaml: 作成完了
  - ./shipping-config.yaml: 作成完了

🔗 Step 4: 接続テスト
  - API接続: ✅ OK
  - 商品マスタ取得: ✅ OK (1,234件)
  - 在庫取得: ✅ OK

🏪 Step 5: 連携モール確認
  - 楽天市場: ✅ 連携中
  - Amazon: ✅ 連携中
  - Yahoo!ショッピング: ✅ 連携中
  - Qoo10: ❌ 未連携

✅ セットアップ完了！

次のステップ:
1. product-config.yaml を編集して商品マッピングを設定
2. /user:next-engine-sync で商品同期をテスト
```

## スキル参照
- @skills/next-engine/SKILL.md

## トラブルシューティング

### 認証エラー
```
エラー: Invalid client credentials
```
→ Client ID / Client Secret を確認してください

### リダイレクトエラー
```
エラー: Redirect URI mismatch
```
→ Developer Networkで登録したURIと一致しているか確認

### 接続タイムアウト
```
エラー: Connection timeout
```
→ ネットワーク接続とファイアウォール設定を確認
