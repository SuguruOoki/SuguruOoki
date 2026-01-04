# オープンロジ連携セットアップガイド

このガイドでは、ネクストエンジンとオープンロジを連携するための完全なセットアップ手順を説明します。

## 目次

1. [前提条件](#前提条件)
2. [アカウント登録](#アカウント登録)
3. [自動セットアップ（推奨）](#自動セットアップ推奨)
4. [手動セットアップ](#手動セットアップ)
5. [API接続確認](#api接続確認)
6. [商品マッピング設定](#商品マッピング設定)
7. [初回テスト実行](#初回テスト実行)
8. [トラブルシューティング](#トラブルシューティング)

---

## 前提条件

### 必須

- ✅ ネクストエンジンアカウント（既に設定済み）
- ✅ Node.js v16以上
- ✅ npm または yarn

### 推奨

- 📦 TypeScript（グローバルインストール）
- 🔧 Git（設定管理）

### 確認コマンド

```bash
# Node.jsバージョン確認
node --version  # v16.0.0以上

# npmバージョン確認
npm --version

# TypeScript確認（オプション）
npx tsc --version
```

---

## アカウント登録

### 1. オープンロジアカウント作成

1. [オープンロジ公式サイト](https://openlogi.com/)にアクセス
2. 「無料で始める」をクリック
3. 必要情報を入力：
   - 会社名
   - 担当者名
   - メールアドレス
   - 電話番号
4. メール認証を完了

### 2. 初期設定

ログイン後、以下を設定：

1. **会社情報**
   - 会社名
   - 住所
   - 連絡先

2. **倉庫情報**
   - 利用する倉庫を選択
   - 倉庫IDをメモ（後で使用）

3. **配送設定**
   - 配送業者の選択
   - 配送料金の設定

### 3. API認証情報の取得

1. 管理画面にログイン
2. 「設定」→「API設定」に移動
3. 「API Key」を生成
4. **重要**: 以下をメモ
   - ✅ API Key
   - ✅ Company ID
   - ✅ 倉庫ID

---

## 自動セットアップ（推奨）

自動セットアップスクリプトを使用すると、ほとんどの設定を対話式で完了できます。

### 実行方法

```bash
# next-engine-configディレクトリに移動
cd next-engine-config

# セットアップスクリプトを実行
npx ts-node scripts/setup-openlogi.ts
```

### セットアップの流れ

スクリプトは以下の手順を自動化します：

#### ステップ1: 環境確認
- Node.jsバージョン確認
- npm確認
- TypeScript確認

#### ステップ2: 設定情報の収集
対話式で以下を入力：

```
📝 ステップ2: 設定情報の収集

オープンロジのAPI認証情報を入力してください。

API Key: ************************
Company ID: comp-12345
API Endpoint: https://api.openlogi.com/v1

通知設定:
通知先メールアドレス: your-email@example.com
エラー通知先メールアドレス: admin@example.com

ブラウザ自動操作設定（API利用不可時のフォールバック）:
ブラウザ自動操作を設定しますか？ (Y/n): Y
オープンロジログインメールアドレス: your-email@example.com
オープンロジログインパスワード: ********
2要素認証を使用しますか？ (y/N): N

倉庫設定:
倉庫ID: warehouse-001
倉庫名: メイン倉庫
倉庫所在地: 関東
```

#### ステップ3: 依存関係のインストール
```
📦 ステップ3: 依存関係のインストール

必要なパッケージをインストールしますか？ (Y/n): Y
インストール中...
- puppeteer をインストール中...
  ✓ puppeteer インストール完了
```

#### ステップ4: ディレクトリ構造の作成
```
📁 ステップ4: ディレクトリ構造の作成

✓ cache/
✓ logs/
✓ logs/openlogi-integration/
✓ logs/openlogi-reports/
✓ logs/openlogi-costs/
✓ logs/browser-screenshots/
✓ logs/browser-errors/
✓ data/
```

#### ステップ5: 環境変数ファイルの生成
```
🔐 ステップ5: 環境変数ファイルの生成

✓ .env ファイルを作成しました
✓ .env.example ファイルを更新しました
```

#### ステップ6: 設定ファイルの更新
```
⚙️ ステップ6: 設定ファイルの更新

✓ openlogi-config.yaml を更新しました
```

#### ステップ7: 商品マッピング設定
```
🔗 ステップ7: 商品マッピング設定

商品マッピング方式を選択してください:
1. 自動マッピング（推奨）: 商品コード/JANコードで自動マッピング
2. 手動マッピング: CSVファイルで手動マッピング
3. ハイブリッド: 両方を併用

マッピング方式を選択 (1/2/3): 1
```

#### 完了
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 セットアップ完了！
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### オプション

高速セットアップ（デフォルト値を使用）:
```bash
npx ts-node scripts/setup-openlogi.ts --use-defaults
```

ブラウザ自動操作をスキップ:
```bash
npx ts-node scripts/setup-openlogi.ts --skip-browser-auth
```

ヘルプ表示:
```bash
npx ts-node scripts/setup-openlogi.ts --help
```

---

## 手動セットアップ

自動セットアップを使用しない場合、以下の手順で手動設定できます。

### 1. 環境変数の設定

`.env` ファイルを作成：

```bash
cp .env.example .env
```

`.env` を編集：

```bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# オープンロジ連携設定
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# API認証
OPENLOGI_API_KEY="your-api-key-here"
OPENLOGI_COMPANY_ID="your-company-id"

# 倉庫設定
OPENLOGI_WAREHOUSE_ID="your-warehouse-id"

# 通知設定
OPENLOGI_NOTIFICATION_EMAIL="your-email@example.com"
OPENLOGI_ERROR_NOTIFICATION_EMAIL="admin@example.com"

# ブラウザ自動操作（オプション）
OPENLOGI_BROWSER_USERNAME="your-email@example.com"
OPENLOGI_BROWSER_PASSWORD="your-password"
# OPENLOGI_TOTP_SECRET="your-totp-secret"  # 2FA使用時
```

### 2. 設定ファイルの更新

`openlogi-config.yaml` を編集：

```yaml
warehouse:
  primary_warehouse:
    warehouse_id: "your-warehouse-id"  # 倉庫IDを設定
    name: "メイン倉庫"
    location: "関東"
```

### 3. ディレクトリの作成

```bash
mkdir -p cache
mkdir -p logs/{openlogi-integration,openlogi-reports,openlogi-costs,browser-screenshots,browser-errors}
mkdir -p data
```

### 4. 依存関係のインストール

```bash
# Puppeteer（ブラウザ自動操作用）
npm install --save puppeteer

# speakeasy（2要素認証用、オプション）
npm install --save speakeasy
npm install --save-dev @types/speakeasy
```

---

## API接続確認

### 方法1: curlコマンド

```bash
# API Keyを環境変数から読み込み
source .env

# 接続テスト
curl -H "Authorization: Bearer $OPENLOGI_API_KEY" \
  https://api.openlogi.com/v1/ping

# 期待される応答
# {"status":"ok","message":"pong"}
```

### 方法2: テストスクリプト（作成予定）

```bash
npm run test:openlogi-connection
```

### 成功時の表示

```
✅ API接続成功
Company ID: comp-12345
Warehouse ID: warehouse-001
API Version: 1.0
```

### エラー時の対処

#### 401 Unauthorized
```
❌ 認証エラー

原因: API Keyが無効
対処:
1. オープンロジ管理画面でAPI Keyを再確認
2. .envファイルのOPENLOGI_API_KEYを更新
```

#### 403 Forbidden
```
❌ アクセス拒否

原因: Company IDが無効
対処:
1. オープンロジ管理画面でCompany IDを確認
2. .envファイルのOPENLOGI_COMPANY_IDを更新
```

#### 500 Internal Server Error
```
❌ サーバーエラー

原因: オープンロジ側の一時的な障害
対処:
1. しばらく待ってから再試行
2. 継続する場合、オープンロジサポートに連絡
```

---

## 商品マッピング設定

商品マッピングは、ネクストエンジンのSKUとオープンロジのSKUを紐付ける重要な設定です。

### 方法1: 自動マッピング（推奨）

#### メリット
- ✅ 設定が簡単
- ✅ メンテナンスフリー
- ✅ 新商品の自動対応

#### 設定

`openlogi-config.yaml` で自動マッピングを有効化：

```yaml
product_mapping:
  mapping_method: "auto"

  auto_mapping:
    use_product_code: true  # 商品コードで自動マッピング
    use_jan_code: true      # JANコードで自動マッピング
    custom_field: "openlogi_sku"  # カスタムフィールド名
```

#### 動作
1. Next EngineのSKU = オープンロジのSKU
2. 一致しない場合、JANコードで検索
3. それでも見つからない場合、カスタムフィールドを参照

### 方法2: 手動マッピング

#### メリット
- ✅ 柔軟なマッピング
- ✅ 複雑な商品構成に対応
- ✅ エイリアス設定が可能

#### 設定

CSVファイルを作成：

```bash
# data/openlogi-sku-mapping.csv
next_engine_sku,openlogi_sku,product_name
SKU-001,OPENLOGI-SKU-001,商品A
SKU-002,OPENLOGI-SKU-002,商品B
SKU-003,OPENLOGI-SKU-003,商品C
```

`openlogi-config.yaml` で手動マッピングを有効化：

```yaml
product_mapping:
  mapping_method: "manual"

  manual_mapping:
    csv_file: "./data/openlogi-sku-mapping.csv"
```

### 方法3: ハイブリッド

自動マッピングと手動マッピングを併用：

```yaml
product_mapping:
  mapping_method: "hybrid"

  auto_mapping:
    use_product_code: true
    use_jan_code: true

  manual_mapping:
    csv_file: "./data/openlogi-sku-mapping.csv"
```

**動作順序:**
1. まず手動マッピングCSVを確認
2. 見つからない場合、自動マッピングを試行

---

## 初回テスト実行

### 1. Dry-Runモード（推奨）

実際には実行せず、動作確認のみ：

```bash
/user:next-engine-openlogi --dry-run
```

**出力例:**
```
🔍 Dry-Runモード: 実際の処理は実行されません

📦 出荷指示シミュレーション

注文ID: ORDER-001
顧客名: 山田太郎
配送先: 東京都渋谷区...
商品:
  - SKU-001 x 2
  - SKU-002 x 1
推定コスト: ¥500

✅ シミュレーション完了（5件の注文を処理予定）

⚠️ 実際に実行する場合:
  /user:next-engine-openlogi
```

### 2. 本番実行

```bash
/user:next-engine-openlogi
```

**確認画面:**
```
📦 出荷指示確認

──────────────────────────────────────────────────────────

注文ID: ORDER-001
顧客名: 山田太郎
配送先: 東京都渋谷区...
商品数: 2点
推定コスト: ¥500

──────────────────────────────────────────────────────────
合計: 5件の注文
推定総コスト: ¥2,500

オープンロジへ出荷指示を送信しますか？ (y/N): y

✅ 出荷指示を承認しました
🌐 オープンロジへ送信中...
✅ 出荷指示送信完了（5件）
```

### 3. ログ確認

```bash
# 統合ログ
tail -f logs/openlogi-integration.log

# ブラウザ自動操作ログ（API失敗時）
tail -f logs/browser-automation.log
```

---

## トラブルシューティング

### よくある問題と解決方法

#### 1. API認証エラー

**症状:**
```
❌ 401 Unauthorized: Invalid API Key
```

**解決方法:**
1. `.env` ファイルの `OPENLOGI_API_KEY` を確認
2. オープンロジ管理画面でAPI Keyを再生成
3. 環境変数を再読み込み: `source .env`

#### 2. 商品マッピングエラー

**症状:**
```
⚠️ SKU-999: マッピングが見つかりません
```

**解決方法:**

**自動マッピングの場合:**
1. Next EngineとオープンロジのSKUが一致しているか確認
2. JANコードが正しく設定されているか確認

**手動マッピングの場合:**
1. `data/openlogi-sku-mapping.csv` にSKUを追加
2. CSVファイルのフォーマットを確認

#### 3. ブラウザ自動操作エラー

**症状:**
```
❌ Puppeteer: Navigation timeout
```

**解決方法:**
1. ネットワーク接続を確認
2. `openlogi-config.yaml` のタイムアウト設定を延長:
```yaml
browser_automation:
  error_handling:
    timeouts:
      page_load: 60000  # 30000 → 60000 に変更
```

#### 4. ログインエラー

**症状:**
```
❌ Login failed: Invalid credentials
```

**解決方法:**
1. `.env` のユーザー名・パスワードを確認
2. オープンロジ管理画面で直接ログインできるか確認
3. 2要素認証が有効な場合、TOTP Secretを設定

#### 5. 在庫同期エラー

**症状:**
```
⚠️ 在庫同期失敗: SKU-001
```

**解決方法:**
1. オープンロジ側の在庫データを確認
2. 倉庫IDが正しく設定されているか確認
3. 同期間隔を延長:
```yaml
inventory:
  sync_from_openlogi:
    sync_interval_hours: 2  # 1 → 2 に変更
```

---

## サポート

### ドキュメント

- [README.md](../README.md) - 概要とクイックスタート
- [SKILL.md](../.claude/skills/next-engine/SKILL.md) - 実装詳細
- [shipping-config.yaml](../shipping-config.yaml) - 配送設定
- [openlogi-config.yaml](../openlogi-config.yaml) - オープンロジ詳細設定

### ログファイル

問題が発生した場合、以下のログを確認：

```bash
# メインログ
cat logs/openlogi-integration.log

# ブラウザ自動操作ログ
cat logs/browser-automation.log

# エラースクリーンショット
ls -la logs/browser-screenshots/

# エラーHTML
ls -la logs/browser-errors/
```

### 公式サポート

- **オープンロジサポート**: https://openlogi.com/support
- **ネクストエンジンサポート**: https://next-engine.net/support

---

## まとめ

このガイドに従って設定することで、ネクストエンジンとオープンロジの連携が完了します。

### チェックリスト

- [ ] オープンロジアカウント作成
- [ ] API認証情報取得
- [ ] 自動セットアップ実行 or 手動設定
- [ ] API接続確認
- [ ] 商品マッピング設定
- [ ] Dry-Runテスト
- [ ] 本番実行

すべて完了したら、定期的な運用とモニタリングを開始してください。
