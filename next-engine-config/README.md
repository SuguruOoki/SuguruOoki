# Next Engine 設定ファイル

楽天市場・Amazon連携用のネクストエンジン設定テンプレートです。

## セットアップ手順

### 1. 環境変数の設定

```bash
# .env.example を .env にコピー
cp .env.example .env

# 認証情報を編集
vi .env
```

### 2. API認証情報の取得

1. [Next Engine Developer Network](https://developer.next-engine.com/) にアクセス
2. アプリケーションを登録
3. Client ID / Client Secret を `.env` に設定

### 3. OAuth認証の実行

```bash
# 認証URLにアクセス
https://api.next-engine.org/api_neauth?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI

# 認証後、コールバックで取得したコードでトークンを取得
```

## ファイル一覧

| ファイル | 説明 |
|---------|------|
| `.env.example` | 環境変数テンプレート |
| `product-config.yaml` | 商品マスタ設定（既存商品考慮対応） |
| `inventory-config.yaml` | 在庫管理設定 |
| `shipping-config.yaml` | 配送設定 |
| `api-config.yaml` | API使用量制限設定 |
| `api-usage.json.example` | API使用状況ファイルのテンプレート |
| `cache/` | 既存商品キャッシュ保存先 |
| `logs/` | 同期ログ・差分レポート保存先 |

## 連携モール

- 楽天市場
- Amazon（自社出荷）

## 既存商品を考慮した同期

商品マスタ同期では、既存商品を事前に取得し差分を検出します。

### 同期フロー

```
1. 既存商品取得 → 2. 差分検出 → 3. 確認 → 4. 同期実行
```

### 差分検出の分類

| 分類 | 説明 | デフォルト動作 |
|------|------|---------------|
| NEW | 新規商品 | 登録 |
| CHANGED | 変更あり | 更新 |
| UNCHANGED | 変更なし | スキップ |
| ORPHANED | ソースにない既存商品 | 警告 |

### 設定例（product-config.yaml）

```yaml
existing_products:
  enabled: true
  sync_behavior:
    on_new: insert
    on_changed: update
    on_unchanged: skip
    on_orphaned: warn
```

## API使用量制限

Next Engine APIは月1000回までの無料枠があり、それを超えると課金が発生します。
このリポジトリでは、API使用量を自動的に追跡して課金を防止する仕組みを提供しています。

### 管理方法の選択

API使用量の管理には2つの方法があります：

1. **ローカル管理**（シンプル）: `api-usage.json` ファイルで管理
2. **リモート管理**（推奨）: Cloudflare Workers + D1 データベースで一元管理

#### リモート管理のメリット

- 複数環境（ローカル、CI/CD等）から同じAPI使用状況を共有
- データベースで永続化され、履歴を保持
- 認証機能でセキュアにアクセス
- 障害時はローカルにフォールバック可能
- テスト環境のコールは自動的にカウント対象外
- **90%到達時点で自動ブロック**

### 初期セットアップ（ローカル管理）

```bash
# API使用状況ファイルを作成
cp api-usage.json.example api-usage.json
```

### リモート管理セットアップ（推奨）

Cloudflare Workersを使用した一元管理を行う場合：

#### 1. Cloudflare Workers のデプロイ

```bash
cd workers/api-usage-manager

# 依存関係をインストール
npm install

# Cloudflareにログイン
wrangler login

# D1データベースを作成
wrangler d1 create next-engine-api-usage

# 出力されたdatabase_idをwrangler.tomlに設定
# [[d1_databases]]
# database_id = "YOUR_D1_DATABASE_ID"

# スキーマを適用
wrangler d1 execute next-engine-api-usage --file=./schema.sql

# API Keyを生成・設定
openssl rand -hex 32  # キーを生成
wrangler secret put API_KEY  # 生成したキーを入力

# 本番環境にデプロイ
wrangler deploy
```

#### 2. ローカル環境の設定

```bash
# 環境変数を設定（.envに追加）
export NEXT_ENGINE_API_MANAGER_URL="https://next-engine-api-manager.YOUR-SUBDOMAIN.workers.dev"
export NEXT_ENGINE_API_MANAGER_KEY="your-api-key-here"
export NEXT_ENGINE_ENV="production"  # または "test"
```

#### 3. api-config.yaml の更新

```yaml
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

詳細は `workers/api-usage-manager/README.md` を参照してください。

#### 4. 他のCloudflare Workersとの統合

認証トークン自動更新Workerなど、他のNext Engine関連Workerからもリモート管理を利用できます。

**統合ガイド**: `workers/auth-integration-guide.md` を参照

**主な統合ポイント:**
- トークン自動更新時のAPIコールを記録
- 1日2回のCron実行でも自動カウント
- 90%到達時に自動ブロックして課金防止

### 使用量の確認

API使用状況は `api-usage.json` に自動記録されます：

```json
{
  "usage": {
    "total_calls": 245,
    "successful_calls": 240,
    "failed_calls": 5
  },
  "limits": {
    "monthly_limit": 1000,
    "remaining": 755,
    "used_percent": 24.5
  }
}
```

### 上限設定のカスタマイズ

`api-config.yaml` で上限を変更できます：

```yaml
usage_limits:
  monthly_limit: 1000  # 月間上限（お好みの値に変更可能）
  warning_threshold_percent: 80   # 警告閾値（80%で警告）
  danger_threshold_percent: 90    # 危険閾値（90%で危険警告）

  on_limit_reached:
    behavior: block  # block: APIコール停止 / warn: 警告のみ
```

### 自動リセット

デフォルトでは毎月1日に自動的にカウントがリセットされます：

```yaml
usage_tracking:
  reset:
    type: monthly  # monthly: 毎月自動リセット / manual: 手動のみ
    day_of_month: 1
```

### 手動リセット

使用状況を手動でリセットする場合：

```bash
# api-usage.jsonを削除して再作成
rm api-usage.json
cp api-usage.json.example api-usage.json
```

### アラート

設定した閾値に達すると自動的にアラートが表示されます：

- **80%到達**: ⚠️ 警告（残り200回）
- **90%到達**: 🚨 危険警告（残り100回）
- **100%到達**: 🛑 APIコールをブロック（設定による）

### 使用状況レポート

月次レポートは `logs/usage-reports/` に自動生成されます。

## オープンロジ連携（物流自動化）

物流代行サービス「オープンロジ」との連携により、出荷業務を自動化できます。

### オープンロジとは

EC事業者向けの物流代行サービスです。商品の保管、ピッキング、梱包、発送までを一括で委託できます。

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

### 初期セットアップ

#### 1. オープンロジアカウント登録

```bash
# オープンロジに登録
https://openlogi.com/

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
    require_confirmation: true  # 確認を必須にする（重要）
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

```bash
# 基本実行（確認あり）
/user:next-engine-openlogi

# オプション
/user:next-engine-openlogi --dry-run        # 実行せず確認のみ
/user:next-engine-openlogi --no-confirm     # 確認スキップ（注意）
/user:next-engine-openlogi --batch-size 30  # バッチサイズ指定
```

### 自動化のポイント

1. **デフォルトでオープンロジを利用**
   - `default_service: true` でデフォルト有効化
   - 出荷条件を満たす注文は自動的にオープンロジへ

2. **確認フローは必須**
   - `require_confirmation: true` で確認を必須化
   - 高額注文や初回注文は特に慎重に確認
   - 確認画面には注文サマリー、コスト推定、配送先を表示

3. **バッチ処理**
   - 一度に大量の出荷指示を送信しない
   - デフォルト: 50件ずつ、1時間ごと

4. **在庫同期**
   - 1時間ごとにオープンロジの在庫を同期
   - 在庫切れを防止

5. **ステータス同期**
   - 30分ごとにオープンロジのステータスを確認
   - 出荷完了時は自動的にNext Engineとモールに反映

### トラブルシューティング

#### 商品マッピングエラー

```bash
# マッピングされていない商品を確認
/user:next-engine-openlogi --check-mapping

# 手動マッピングCSVを生成
/user:next-engine-openlogi --export-unmapped
```

#### API接続エラー

```bash
# API認証情報を確認
echo $OPENLOGI_API_KEY
echo $OPENLOGI_COMPANY_ID

# 接続テスト
curl -H "Authorization: Bearer $OPENLOGI_API_KEY" \
  https://api.openlogi.com/v1/ping
```

### ブラウザ自動操作（API利用不可時）

APIが利用できない、または上限に達した場合、自動的にブラウザ操作にフォールバックします。

#### 初期セットアップ

```bash
# Puppeteerをインストール
npm install puppeteer

# 2要素認証を使用する場合
npm install speakeasy
```

#### 環境変数の設定

`.env` ファイルにブラウザログイン情報を追加：

```bash
# オープンロジブラウザログイン情報
OPENLOGI_BROWSER_USERNAME="your-email@example.com"
OPENLOGI_BROWSER_PASSWORD="your-password"

# 2要素認証（オプション）
OPENLOGI_TOTP_SECRET="your-totp-secret"
```

#### 設定ファイルの確認

`openlogi-config.yaml` でブラウザ自動操作が有効になっていることを確認：

```yaml
browser_automation:
  enabled: true

  use_when:
    api_unavailable: true
    api_limit_reached: true
    consecutive_api_errors: 3

  browser:
    engine: "chromium"
    headless: true
```

#### フォールバック動作

1. **通常時**: APIで処理
2. **API連続エラー3回**: 自動的にブラウザ操作に切り替え
3. **ブラウザ操作失敗**: 手動処理へフォールバック

#### ブラウザ操作の監視

```bash
# ブラウザ操作ログを確認
tail -f ./logs/browser-automation.log

# スクリーンショットを確認
ls -la ./logs/browser-screenshots/

# エラー時のHTML保存先
ls -la ./logs/browser-errors/
```

#### .gitignoreへの追加

ブラウザ自動操作関連ファイルをGit管理対象外にする：

```bash
# .gitignore に以下を追加
echo "" >> .gitignore
echo "# Browser Automation" >> .gitignore
echo "next-engine-config/cache/openlogi-session.json" >> .gitignore
echo "next-engine-config/logs/browser-screenshots/" >> .gitignore
echo "next-engine-config/logs/browser-errors/" >> .gitignore
echo "next-engine-config/logs/browser-automation.log" >> .gitignore
```

#### 通知設定

ブラウザ操作への切り替え時に通知を受け取る：

```yaml
# openlogi-config.yaml
browser_automation:
  notifications:
    on_browser_fallback:
      enabled: true
      method: "email"
      message: "API利用不可のため、ブラウザ自動操作に切り替えました"
```

#### 本番環境での注意事項

1. **ヘッドレスモード**: 本番環境では `headless: true` を推奨
2. **セッション管理**: Cookie保存でログイン回数を削減
3. **エラー通知**: 管理者への即時通知を有効化
4. **スクリーンショット**: トラブル調査のため保存を推奨
5. **リソース最適化**: 画像・フォント読み込みを無効化してパフォーマンス向上

### 参考資料

- [オープンロジ公式サイト](https://openlogi.com/)
- [オープンロジAPI ドキュメント](https://openlogi.com/api-docs/)
- 詳細: `.claude/skills/next-engine/SKILL.md` のオープンロジ連携セクション

---

## 次のステップ

1. `.env` ファイルに認証情報を設定
2. `api-usage.json` を作成（`cp api-usage.json.example api-usage.json`）
3. オープンロジ連携設定（任意）
4. `/user:next-engine-sync --diff-only` で差分確認
5. `/user:next-engine-sync` で商品同期
6. `/user:next-engine-inventory` で在庫同期
7. `/user:next-engine-openlogi` で出荷自動化（オープンロジ利用時）
