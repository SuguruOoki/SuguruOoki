# Cloudflare Pages デプロイ設定ガイド

このガイドでは、GitHubプロフィールページをCloudflare Pagesに自動デプロイするための設定方法を説明します。

## 前提条件

- Cloudflareアカウント（無料でも使用可能）
- GitHub リポジトリへの管理者権限

## 1. Cloudflare API の設定

### Cloudflare API トークンの取得

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. 右上のユーザーアイコン → **「マイプロフィール」** をクリック
3. **「API トークン」** タブを選択
4. **「トークンを作成する」** をクリック
5. **「カスタムトークン」** を選択

### API トークンの権限設定

以下の権限を設定してください：

```
権限:
- Zone:Zone:Read
- Zone:Page Rules:Edit
- Account:Cloudflare Pages:Edit

アカウントリソース:
- Include: All accounts

ゾーンリソース:
- Include: All zones
```

### Cloudflare アカウント ID の取得

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) の右側にある **「アカウント ID」** をコピー

## 2. GitHub Secrets の設定

GitHubリポジトリで以下のSecretsを設定します：

1. リポジトリページで **Settings** → **Secrets and variables** → **Actions** を選択
2. **「New repository secret」** をクリックして以下を追加：

### 必要なSecrets

```bash
# Cloudflare API トークン
CLOUDFLARE_API_TOKEN=your_api_token_here

# Cloudflare アカウント ID
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
```

## 3. Cloudflare Pages プロジェクトの作成（オプション）

ワークフローでは自動的にプロジェクトが作成されますが、事前に作成することも可能です：

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) で **Pages** セクションに移動
2. **「プロジェクトを作成」** をクリック
3. **「Direct Upload」** を選択
4. プロジェクト名を `suguruooki-profile` に設定（ワークフローファイルと一致）

## 4. デプロイの実行

### 自動デプロイ

以下の場合に自動的にデプロイが実行されます：

- `main` または `master` ブランチへのプッシュ
- 毎日 0:30 JST に自動実行（他のワークフロー完了後）

### 手動デプロイ

1. GitHubリポジトリの **Actions** タブに移動
2. **「Deploy to Cloudflare Pages」** ワークフローを選択
3. **「Run workflow」** をクリック

## 5. デプロイされたサイトの確認

デプロイが完了すると、以下のようなURLでアクセスできます：

```
https://suguruooki-profile.pages.dev
```

または、カスタムドメインを設定することも可能です。

## 6. カスタムドメインの設定（オプション）

1. Cloudflare Dashboard の **Pages** セクションでプロジェクトを選択
2. **「Custom domains」** タブを選択
3. **「Set up a custom domain」** をクリック
4. ドメイン名を入力して設定

## トラブルシューティング

### デプロイエラーの確認

1. GitHub Actions の **Actions** タブでワークフローログを確認
2. Cloudflare Dashboard の **Pages** セクションでデプロイ履歴を確認

### よくある問題

#### API トークンエラー
- API トークンの権限設定を再確認
- アカウント ID が正しいか確認

#### ファイルが見つからないエラー
- 他のワークフロー（metrics、profile-summary-cards）が正常に実行されているか確認
- リポジトリに必要なファイルが存在するか確認

#### プロジェクト名の競合
- `deploy-cloudflare.yml` の `project-name` を一意の名前に変更

## セキュリティ注意事項

- API トークンは適切な権限のみを付与し、定期的に更新してください
- GitHub Secrets は暗号化されて保存されますが、必要以上の権限を付与しないでください

## サポート

問題が発生した場合は、以下を確認してください：

- [Cloudflare Pages ドキュメント](https://developers.cloudflare.com/pages/)
- [GitHub Actions ドキュメント](https://docs.github.com/ja/actions)