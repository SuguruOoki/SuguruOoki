# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a GitHub profile repository (special repo named `SuguruOoki/SuguruOoki`) that automatically generates and displays GitHub statistics, metrics, and profile visualizations. The README.md is displayed on the GitHub profile page at https://github.com/SuguruOoki.

## Architecture

### Automated Profile Generation System
- **GitHub Actions Workflows**: Multiple scheduled workflows generate profile statistics
- **Static Site Deployment**: Cloudflare Pages deployment serves a web version of the profile
- **Asset Generation**: SVG graphics and profile cards are auto-generated and committed

### Key Components

1. **Profile Statistics Generation** (`.github/workflows/`)
   - `metrics.yml`: Generates comprehensive GitHub metrics using lowlighter/metrics
   - `profile-summary-cards.yml`: Creates language and commit statistics cards
   - `3d.yml`: Generates 3D contribution visualization
   - All run on scheduled cron jobs and auto-commit generated assets

2. **Cloudflare Pages Deployment** (`.github/workflows/deploy-cloudflare.yml`)
   - Builds static HTML site from generated metrics
   - Deploys to Cloudflare Pages at `suguruooki-profile.pages.dev`
   - Runs daily at 0:30 JST after other workflows complete

3. **Generated Assets** (committed to repo)
   - `github-metrics.svg`: Main metrics visualization
   - `profile-summary-card-output/`: Multi-theme profile cards
   - `profile-3d-contrib/`: 3D contribution graphs
   - `profile.jpg`: Profile image

## Common Workflows

### Updating Profile Content
Edit `README.md` directly - this is displayed on the GitHub profile page.

### Triggering Manual Updates
All workflows support manual dispatch:
```bash
# Via GitHub UI: Actions tab → Select workflow → "Run workflow"
# Or via gh CLI:
gh workflow run metrics.yml
gh workflow run profile-summary-cards.yml
gh workflow run 3d.yml
gh workflow run deploy-cloudflare.yml
```

### Modifying Profile Statistics
- **Metrics configuration**: Edit `.github/workflows/metrics.yml` plugin settings
- **Summary cards**: Configuration is in `.github/workflows/profile-summary-cards.yml`
- **3D contributions**: Controlled by `.github/workflows/3d.yml`

### Cloudflare Deployment Setup
See `CLOUDFLARE_SETUP.md` for detailed setup instructions. Required secrets:
- `CLOUDFLARE_API_TOKEN`: API token with Pages:Edit permission
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account identifier
- `ACTION_SECRETS`: GitHub personal access token for workflows

## GitHub Actions Secrets

This repository requires the following secrets:
- `ACTION_SECRETS`: GitHub PAT for metrics/stats generation workflows
- `CLOUDFLARE_API_TOKEN`: For Cloudflare Pages deployment
- `CLOUDFLARE_ACCOUNT_ID`: For Cloudflare Pages deployment

## Automated Processes

### Schedule
- Metrics: Daily at 00:00 UTC
- Profile Summary Cards: Every 24 hours
- 3D Contributions: Daily at 18:00 UTC
- Cloudflare Deploy: Daily at 00:30 JST (after metrics generation)

### Auto-commit Behavior
The 3D contribution workflow auto-commits with message `"[MODIFY]update my profile"` using:
- User: SuguruOoki
- Email: oki.work0527@gmail.com

## Development Notes

### No Source Code
This repository contains no application source code - it's purely for profile visualization and automated metrics generation.

### Static Assets Management
All generated SVG and image files are committed to the repository and referenced in README.md. These files are regenerated automatically by workflows.

### Lint Workflow Reference
`.github/workflows/lint.yml` exists but has no actual code to lint (references pnpm commands that don't exist in this repo). This appears to be a template file that can be ignored.

## Issue Management

Issues use automated branch creation via `robvanderleek/create-issue-branch`:
- Branch naming: `i${issue.number}-${issue.title}`
- Epic and debt labels skip auto-branch creation
- Configuration: `.github/issue-branch.yml`

---

## Next Engine Skill

このリポジトリにはネクストエンジンEC自動化スキルが含まれています。

### スキル
- `.claude/skills/next-engine/SKILL.md` - ネクストエンジン連携スキル定義

### 利用可能コマンド

| コマンド | 説明 |
|---------|------|
| `/next-engine-setup` | 初期セットアップ（認証・設定ファイル生成） |
| `/next-engine-sync` | 商品マスタ同期 |
| `/next-engine-inventory` | 在庫更新 |
| `/next-engine-shipping` | 配送設定 |

### 対応機能
- 商品マスタ設定（登録・更新・カテゴリ設定）
- 在庫管理（統合/モール別在庫・アラート）
- 配送設定（ヤマト・佐川・日本郵便連携）
- マルチモール対応（楽天・Amazon・Qoo10・Yahoo）

詳細は `.claude/skills/next-engine/SKILL.md` を参照してください。
